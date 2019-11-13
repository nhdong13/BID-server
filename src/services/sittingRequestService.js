import models from '@models';
import { matching } from '@services/matchingService';
import { recommendToParent } from '@services/recommendService';
import { sendSingleMessage } from '@utils/pushNotification';
import { invitationMessages } from '@utils/notificationMessages';
import { testSocketIo } from '@utils/socketIo';
import { checkCheckInStatus, checkCheckOutStatus } from '@utils/common';
import {
    getScheduleTime,
    checkBabysitterSchedule,
    checkRequestTime,
} from '@utils/schedule';
import {
    createReminder,
    createCheckoutPoint,
} from '@services/schedulerService';
import Sequelize from 'sequelize';

import env, { checkEnvLoaded } from '@utils/env';

checkEnvLoaded();
const { dbHost, dbUser, dbPass, dbName, dbDialect } = env;

const sequelize = new Sequelize(dbName, dbUser, dbPass, {
    host: dbHost,
    dialect: dbDialect,
    define: {
        paranoid: false,
        underscored: false,
        timestamps: false,
        freezeTableName: false,
    },
    logging: false,
});

export function acceptSitter(requestId, sitterId) {
    return sequelize.transaction((t) => {
        return lockBabysitterForUpdate(sitterId, t).then((babysitter) => {
            return findRequest(requestId, t).then((request) => {
                if (request) {
                    // check available
                    let available = checkAvailable(request, babysitter);
                    if (!available) {
                        throw new Error('OVERLAP');
                    } else {
                        return confirmRequest(requestId, sitterId, t).then(
                            (res) => {
                                // confirm the sitter invitation
                                confirmInvitaion(requestId, sitterId, t);
                                // create sitter schedule for this sitting
                                createSchedule(request, sitterId, requestId, t);
                                // update any invitations of this babysitter that overlap with this request
                                updateInvitations(
                                    sitterId,
                                    requestId,
                                    request,
                                    t,
                                );

                                // notify to the accepted babysitter
                                notifyBabysitter(requestId, sitterId, t);

                                // expire other invitation of this request
                                return expireInvitations(
                                    requestId,
                                    sitterId,
                                    t,
                                );
                            },
                        );
                    }
                }
            });
        });
    });
}

function lockBabysitterForUpdate(sitterId, transaction) {
    return models.babysitter.findOne({
        where: {
            userId: sitterId,
        },
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
        transaction: transaction,
        lock: transaction.LOCK.UPDATE,
    });
}

function findRequest(requestId, transaction) {
    return models.sittingRequest.findOne({
        where: {
            id: requestId,
        },
        transaction: transaction,
        lock: transaction.LOCK.UPDATE,
    });
}

function checkAvailable(request, babysitter) {
    let available = checkBabysitterSchedule(babysitter, request);

    return available;
}

function confirmRequest(requestId, sitterId, transaction) {
    // update sitting request
    return models.sittingRequest.update(
        {
            status: 'CONFIRMED',
            acceptedBabysitter: sitterId,
        },
        {
            where: {
                id: requestId,
            },
            transaction: transaction,
            lock: transaction.LOCK.UPDATE,
        },
    );
}

function createSchedule(request, sitterId, requestId, transaction) {
    // create a schedule for the accepted babysitter'schedules
    try {
        let scheduleTime = getScheduleTime(request);
        let schedule = {
            userId: sitterId,
            requestId: requestId,
            scheduleTime: scheduleTime,
            type: 'FUTURE',
        };
        models.schedule.create(schedule, {
            transaction: transaction,
            lock: transaction.LOCK.UPDATE,
        });

        createReminder(sitterId, requestId, scheduleTime);
    } catch (error) {
        console.log(error);
    }
}

function updateInvitations(sitterId, requestId, request, transaction) {
    // update invitations of the accepted babysitter that colission with this request
    // first find all invitations sent to this babysitter from sitting-requests with the same date as this request
    models.invitation
        .findAll({
            where: {
                receiver: sitterId,
                status: {
                    [Sequelize.Op.or]: ['ACCEPTED', 'PENDING'],
                },
            },
            include: [
                {
                    model: models.sittingRequest,
                    as: 'sittingRequest',
                    where: {
                        sittingDate: request.sittingDate,
                        id: {
                            [Sequelize.Op.ne]: requestId,
                        },
                    },
                },
            ],
            transaction: transaction,
            lock: transaction.LOCK.UPDATE,
        })
        .then((unavailableInvitations) => {
            // then set EXPIRED status for those invitations
            // first check if the time is overlap each other or not
            unavailableInvitations.forEach((invite) => {
                if (checkRequestTime(invite.sittingRequest, request)) {
                    models.invitation.update(
                        {
                            status: 'OVERLAP',
                        },
                        {
                            where: {
                                id: invite.id,
                            },
                            transaction: transaction,
                            lock: transaction.LOCK.UPDATE,
                        },
                    );
                }
            });
        });
}

function notifyBabysitter(requestId, sitterId, transaction) {
    // notify the accepted babysitter
    models.invitation
        .findOne({
            where: {
                requestId: requestId,
                receiver: sitterId,
            },
            include: [
                {
                    model: models.user,
                    as: 'user',
                    include: [
                        {
                            model: models.tracking,
                            as: 'tracking',
                        },
                    ],
                },
            ],
            transaction: transaction,
            lock: transaction.LOCK.UPDATE,
        })
        .then((invitation) => {
            if (invitation) {
                if (invitation.user != null) {
                    if (invitation.user.tracking != null) {
                        const notification = {
                            id: invitation.id,
                            pushToken: invitation.user.tracking.token,
                            message:
                                invitationMessages.parentAcceptedBabysitter,
                        };
                        sendSingleMessage(notification);
                    }
                }
            }
        });
}

function expireInvitations(requestId, sitterId, transaction) {
    // then update other babysitter's invitation status to EXPIRED
    let selector = {
        where: {
            requestId: requestId,
            receiver: {
                [Sequelize.Op.ne]: sitterId,
            },
        },
        transaction: transaction,
        lock: transaction.LOCK.UPDATE,
    };
    return models.invitation.update(
        {
            status: 'EXPIRED',
        },
        selector,
    );
}

function confirmInvitaion(requestId, sitterId, transaction) {
    // update the accepted babysitter's invitation status to CONFIRMED
    let selector = {
        where: {
            requestId: requestId,
            receiver: sitterId,
        },
        transaction: transaction,
        lock: transaction.LOCK.UPDATE,
    };
    models.invitation.update(
        {
            status: 'CONFIRMED',
        },
        selector,
    );
}

export async function handleForgotToCheckout(requestId) {
    let request = await models.sittingRequest.findOne({
        where: {
            id: requestId,
            status: 'ONGOING',
        },
    });
    console.log('Duong: handleForgotToCheckout -> request', request);

    if (request) {
        await models.sittingRequest.update(
            {
                status: 'DONE_UNCONFIMRED',
            },
            {
                where: {
                    id: requestId,
                },
            },
        );
    }
}