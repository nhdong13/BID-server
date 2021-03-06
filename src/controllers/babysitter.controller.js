import models from '@models';
import { hashPassword } from '@utils/hash';
import { checkSittingTime, dateInRange } from '@utils/common';
import { searchBabysitterAdvanced } from '@services/searchService';

const list = async (req, res, next) => {
    const listSitters = await models.babysitter.findAll({
        where: {},
        include: [
            {
                model: models.user,
                as: 'user',
                // attributes: ['id'],
                include: [
                    {
                        model: models.sitterSkill,
                        as: 'sitterSkills',
                        attributes: ['skillId'],
                        include: [
                            {
                                model: models.skill,
                                attributes: ['vname'],
                            },
                        ],
                    },
                    {
                        model: models.sitterCert,
                        as: 'sitterCerts',
                        attributes: ['certId'],
                        include: [
                            {
                                model: models.cert,
                                attributes: ['vname'],
                            },
                        ],
                    },
                ],
            },
        ],
    });
    res.status(200);
    res.send(listSitters);
};

const create = async (req, res) => {
    const newUser = req.body.user;
    const newSitter = req.body.sitter;

    try {
        // Create user first
        newUser.password = await hashPassword(newUser.password);

        const createdUser = await models.user
            .create(newUser)
            .then(async (res) => {
                let newTracking = {};
                const token = await models.tracking.create(newTracking);
                const createdSitter = await models.babysitter.create(newSitter);
                return newSitter;
            });
        res.send(createdSitter);
    } catch (err) {
        res.status(400);
        res.send(err);
    }
};

const listAllBabysitterWithSchedule = async (req, res, next) => {
    try {
        const list = await models.babysitter.findAll({
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
        res.status(200);
        res.send(list);
    } catch (error) {
        res.status(400);
        res.send(error);
    }
};

const readByRequest = async (req, res) => {
    const sitterId = req.params.sitterId;
    const requestId = req.params.requestId;

    try {
        const sitter = await models.babysitter.findOne({
            where: {
                userId: sitterId,
            },
            include: [
                {
                    model: models.user,
                    as: 'user',
                    include: [
                        {
                            model: models.sitterSkill,
                            as: 'sitterSkills',
                            attributes: ['skillId'],
                            include: [
                                {
                                    model: models.skill,
                                    attributes: ['vname'],
                                },
                            ],
                        },
                        {
                            model: models.sitterCert,
                            as: 'sitterCerts',
                            attributes: ['certId'],
                            include: [
                                {
                                    model: models.cert,
                                    attributes: ['vname'],
                                },
                            ],
                        },
                    ],
                },
            ],
        });

        if (sitter) {
            await models.invitation
                .findOne({
                    where: {
                        requestId: requestId,
                        receiver: sitterId,
                    },
                })
                .then((result) => {
                    if (result != null) {
                        sitter.isInvited = true;
                    }
                    res.status(200);
                    res.send(sitter);
                });
        } else {
            res.status(404);
            res.send();
        }
    } catch (err) {
        res.status(400);
        res.send(err);
    }
};

const read = async (req, res) => {
    const id = req.params.id;
    console.log(id);
    try {
        const sitter = await models.babysitter.findOne({
            where: {
                userId: id,
            },
            include: [
                {
                    model: models.user,
                    as: 'user',
                    include: [
                        {
                            model: models.sitterSkill,
                            as: 'sitterSkills',
                            attributes: ['skillId'],
                            include: [
                                {
                                    model: models.skill,
                                    attributes: ['vname'],
                                },
                            ],
                        },
                        {
                            model: models.sitterCert,
                            as: 'sitterCerts',
                            attributes: ['certId'],
                            include: [
                                {
                                    model: models.cert,
                                    attributes: ['vname'],
                                },
                            ],
                        },
                    ],
                },
            ],
        });
        if (sitter) {
            res.status(200);
            res.send(sitter);
        } else {
            res.status(404);
            res.send();
        }
    } catch (err) {
        res.status(400);
        res.send(err);
    }
};

const search = async (req, res) => {
    let name = req.body.name;
    let skills = req.body.skills;
    let certs = req.body.certs;
    let baseAddress = req.body.baseAddress;
    
    try {
        const sitters = await searchBabysitterAdvanced(name, skills, certs, baseAddress);

        // response
        res.send({
            count: sitters.length,
            sitters
        });
    } catch (err) {
        console.log(err);
        res.status(400);
        res.send(err);
    }
};

const update = async (req, res) => {
    const id = req.params.id;

    const updatingSitter = req.body;
    console.log('PHUC: update -> updatingSitter', updatingSitter);

    try {
        await models.babysitter.update(updatingSitter, {
            where: {
                userId: id,
            },
        });

        let pendingInvitations = await models.invitation.findAll({
            where: {
                receiver: id,
                status: 'PENDING',
            },
            include: {
                model: models.sittingRequest,
                as: 'sittingRequest',
            },
        });

        // Expiring invitations from sittingRequests that not suitable annymore because babysitter schedule changed
        if (pendingInvitations) {
            const promises = pendingInvitations.map(async (invite) => {
                if (
                    dateInRange(
                        invite.sittingRequest.sittingDate,
                        updatingSitter.weeklySchedule,
                    )
                ) {
                    if (
                        !checkSittingTime(
                            invite.sittingRequest.startTime,
                            invite.sittingRequest.endTime,
                            updatingSitter.startTime,
                            updatingSitter.endTime,
                        )
                    ) {
                        await models.invitation.update(
                            {
                                status: 'EXPIRED',
                            },
                            {
                                where: {
                                    id: invite.id,
                                },
                            },
                        );
                    }
                } else {
                    await models.invitation.update(
                        {
                            status: 'EXPIRED',
                        },
                        {
                            where: {
                                id: invite.id,
                            },
                        },
                    );
                }
            });
            await Promise.all(promises);
        }

        res.send();
    } catch (err) {
        res.status(422);
        res.send(err);
    }
};

const destroy = async (req, res) => {
    const id = req.params.id;

    try {
        await models.babysitter.destroy({
            where: {
                id,
            },
        });
        res.status(204);
        res.send();
    } catch (err) {
        res.status(422);
        res.send(err);
    }
};

export default {
    list,
    create,
    read,
    readByRequest,
    search,
    update,
    destroy,
    listAllBabysitterWithSchedule,
};
