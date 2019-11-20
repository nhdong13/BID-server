import models from '@models/';
import {
    parseSchedule,
    checkScheduleTime,
    checkBabysitterSchedule,
} from '@utils/schedule';
import { splitTimeRange } from '@utils/common';
import env, { checkEnvLoaded } from '@utils/env';

checkEnvLoaded();
const { apiKey } = env;

const MAX_TRAVEL_DISTANCE = 1;
const KEY = apiKey;
var distance = require('google-distance-matrix');

const googleMaps = require('@google/maps');
const mapsClient = googleMaps.createClient({
    key: KEY, // api key
    Promise: Promise, // enable promise request
});

/**
 * matching parent's sitting request with available babysitter
 * @param  {sittingRequest} sittingRequestresponse
 * @return {Array<babysitter>} matchedList
 */
export async function matching(sittingRequest) {
    console.log('------------------------Matching------------------------');
    // find any babysitter in 1 km travel distance of the sitting address
    let babysitters = await searchForBabysitter(sittingRequest.sittingAddress);

    // compare each babysitter in the above list against matching criteria and return the matched list
    let matchedList = await matchingCriteria(sittingRequest, babysitters);

    // calculate distance with api Google
    matchedList = await getBabysitterDistance(
        sittingRequest.sittingAddress,
        matchedList,
    );

    // calculate distance with magic and stuff you know
    // matchedList = await randomizeDistance(
    //     sittingRequest.sittingAddress,
    //     matchedList,
    // );

    // check against babysitter schedules
    matchedList = checkAgainstSchedules(sittingRequest, matchedList);

    // only run if this request is created (has id)
    if (
        sittingRequest.id !== undefined &&
        sittingRequest.id !== null &&
        sittingRequest.id > 0
    ) {
        matchedList = await checkIfSentInvite(sittingRequest, matchedList);
    }

    console.log(
        '------------------------DONE MATCHING------------------------',
    );

    console.log('Matched:', matchedList.length);

    return matchedList;
}

/**
 * search for every babysitters in 'MAX_TRAVEL_DISTANCE' travel distance from parent
 * @param  {String} sittingAddress
 * @returns {} list of babysitters
 */
async function searchForBabysitter(sittingAddress) {
    let list = await models.babysitter.findAll({
        include: [
            {
                model: models.user,
                as: 'user',
                include: [
                    {
                        model: models.schedule,
                        as: 'schedules',
                    },
                ],
            },
        ],
    });

    return list;
}

/**
 * get the distance between the sitting address and the babysitter's address
 * and filter out babysitters who are too far away (> MAX_TRAVEL_DISTANCE)
 * @param  {String} sittingAddress
 * @param  {Array<babysitter>} listOfSitter
 * @returns {} matchedList distance is in 'km'
 */
async function getBabysitterDistance(sittingAddress, listOfSitter) {
    console.log('--- Getting distance data ...');
    let matchedList = [];

    let address1LatLog = await placeSearch(sittingAddress);

    try {
        const promises = listOfSitter.map(async (sitter) => {
            // x.x km || x.x m
            let distance = await getDistance(
                address1LatLog,
                sitter.user.address,
            );

            // x.x
            let temp = distance.split(' ');
            let unit = temp[1];
            if (unit == 'km') {
                let distanceKm = temp[0];
                if (distanceKm < MAX_TRAVEL_DISTANCE) {
                    sitter.distance = distance;
                    matchedList.push(sitter);
                } else {
                    console.log(
                        `${sitter.user.nickname} is two far away: ${distance}`,
                    );
                }
            } else {
                sitter.distance = distance;
                matchedList.push(sitter);
            }
        });
        await Promise.all(promises);
    } catch (error) {
        console.log('Duong: getBabysitterDistance -> error', error);
    }

    console.log('--- Done getting distance data ...');
    return matchedList;
}

/**
 * random distances
 * @param  {String} sittingAddress
 * @param  {Array<babysitter>} listOfSitter
 * @returns {} matchedList distance in 'km'
 */
async function randomizeDistance(sittingAddress, listOfSitter) {
    let matchedList = [];

    const promises = listOfSitter.map(async (sitter) => {
        // x.x
        let distance = await parseFloat(sitter.userId / 10).toFixed(1);

        if (distance < 1) {
            sitter.distance = distance;
            matchedList.push(sitter);
        }
    });
    await Promise.all(promises);

    return matchedList;
}

/**
 * check if the matched babysitters is sent with an invitation
 * @param  {sittingRequest} sittingRequest
 * @param  {Array<babysitter>} babysitters
 * @returns {} babysitters with status isInvited
 */
async function checkIfSentInvite(sittingRequest, babysitters) {
    const promises = babysitters.map(async (sitter) => {
        let found = await models.invitation.findOne({
            where: {
                requestId: sittingRequest.id,
                receiver: sitter.userId,
            },
        });

        if (found) {
            sitter.isInvited = true;
        }
    });
    await Promise.all(promises);

    return babysitters;
}

/**
 * get the distance between 2 address using google distance matrix api
 * @param  {String} address1
 * @param  {String} address2
 * @returns {} the distance in 'km'
 */
async function getDistance(address1LatLog, address2) {
    let place_2 = await placeSearch(address2);

    try {
        let distances = await mapsClient
            .distanceMatrix({
                origins: [address1LatLog[0].geometry.location], // start address
                destinations: [place_2[0].geometry.location], // destination address
                mode: 'walking',
            })
            .asPromise();
        // console.log(distances.requestUrl);

        return distances.json.rows[0].elements[0].distance.text;
    } catch (error) {
        console.log('Duong: getDistance -> error', error);
    }
}

async function placeSearch(address) {
    try {
        let result = await mapsClient
            .findPlace({
                input: address,
                inputtype: 'textquery',
                fields: ['geometry'],
            })
            .asPromise();
        return result.json.candidates;
    } catch (error) {
        console.log('Duong: placeSearch -> error', error);
    }
}

/**
 * To check if the sitting-request matched with the babysitter's sitting preferences
 * (max number of children, min age of children, weekly schedule, work time)
 * @param  {sittingRequest} request the sitting request
 * @param  {Array<babysitter>} babysitters the list of babysitters to check
 * @returns {Array} matchedList
 */
async function matchingCriteria(request, babysitters) {
    let matchedList = [];
    console.log('--- Matching with criteria');
    console.log('Number of search: ' + babysitters.length);
    babysitters.forEach((bsitter) => {
        // check children number
        if (request.childrenNumber > bsitter.maxNumOfChildren) {
            console.log('CHILDREN NUMBER NOT MATCHED');
            console.log(
                'request: ' +
                    request.childrenNumber +
                    '| bsitter: ' +
                    bsitter.maxNumOfChildren,
            );
            return;
        }
        //check minimum age of childer
        if (request.minAgeOfChildren < bsitter.minAgeOfChildren) {
            console.log('MIN AGE NOT MATCHED');
            console.log(
                'request: ' +
                    request.minAgeOfChildren +
                    '| bsitter: ' +
                    bsitter.minAgeOfChildren,
            );
            return;
        }
        // check date
        if (!dateInRange(request.sittingDate, bsitter.weeklySchedule)) {
            console.log('SITTING DATE NOT MATCHED');
            console.log(
                'request: ' +
                    request.sittingDate +
                    '| bsitter: ' +
                    bsitter.weeklySchedule,
            );
            return;
        }
        // check time
        if (
            !checkSittingTime(
                request.startTime,
                request.endTime,
                bsitter.daytime,
                bsitter.evening,
            )
        ) {
            console.log('SITTING TIME NOT MATCHED');
            console.log('request: ');
            console.log('--- start time: ' + request.startTime);
            console.log('--- end time: ' + request.endTime);
            console.log('bsitter: ');
            console.log('--- daytime: ' + bsitter.daytime);
            console.log('--- evening: ' + bsitter.evening);
            return;
        }

        // add matched
        matchedList.push(bsitter);
    });

    console.log('--- Done matching with criteria');
    return matchedList;
}

/**
 * To check if the sitting-request's sitting date, start time, end time are matched with the babysitter's schedule
 * @param  {sittingRequest} request the sitting request
 * @param  {Array<babysitter>} babysitters the list of babysitters to check
 * @returns {Array} matchedList
 */
function checkAgainstSchedules(request, babysitters) {
    let matchedList = [];

    babysitters.forEach((sitter) => {
        if (checkBabysitterSchedule(sitter, request)) {
            matchedList.push(sitter);
        }
    });

    return matchedList;
}

/**
 * check if the sitting request date are in babysitter weekly schedule
 * @param  {Date} date the sitting date
 * @param  {String} range the babysitter's weekly schedule
 * @returns {Boolean} true or false
 */
function dateInRange(date, range) {
    let flag = false;

    let weekDay = getDayOfWeek(date);

    let bsitterWorkDates = getWeekRange(range);

    bsitterWorkDates.forEach((workDate) => {
        if (workDate == weekDay) {
            flag = true;
            return;
        }
    });

    return flag;
}

/**
 * get day of the week of a date
 * @param  {Date} date
 */
function getDayOfWeek(date) {
    var dayOfWeek = new Date(date).getDay();
    return isNaN(dayOfWeek)
        ? null
        : ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][dayOfWeek];
}

/**
 * get array of days of the week of a babysitter schedule
 * @param  {String} range
 * @returns {Array<String>}
 */
function getWeekRange(range) {
    if (range == null) {
        return null;
    }
    let arr = [];

    arr = range.split(',');

    return arr;
}

/**
 * check if the request time and babysitter vailable is matched
 * @param  {String} startTime
 * @param  {String} endTime
 * @param  {String} bDaytime
 * @param  {String} bEvening
 * @returns {Boolean}
 */
function checkSittingTime(startTime, endTime, bDaytime, bEvening) {
    let flag = false;
    let daytime = splitTimeRange(bDaytime);
    let evening = splitTimeRange(bEvening);
    let combine = null;

    // if daytime end equal evening time start then combine work time to daytime start and evening end
    if (daytime[1] == evening[0]) {
        combine = [daytime[0], evening[1]];
    }

    // check for combine time if it not null
    if (combine != undefined && combine != null) {
        if (timeIsInRange(startTime, combine)) {
            if (timeIsInRange(endTime, combine)) {
                flag = true;
            }
        }
    }

    // check for daytime or evening time
    if (timeIsInRange(startTime, daytime)) {
        if (timeIsInRange(endTime, daytime)) {
            flag = true;
        }
    } else if (timeIsInRange(startTime, evening)) {
        if (timeIsInRange(endTime, evening)) {
            flag = true;
        }
    }

    return flag;
}

/**
 * check if time in range
 * @param  {String} time
 * @param  {Array<String>} range
 * @returns {Boolean}
 */
function timeIsInRange(time, range) {
    if (range == null) {
        return false;
    }

    if (time >= range[0] && time <= range[1]) {
        return true;
    }

    return false;
}
