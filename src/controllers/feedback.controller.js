import models from '@models';

const Sequelize = require('sequelize');
const list = async (req, res, next) => {
    try {
        const list = await models.feedback.findAll({
            include: [
                {
                    model: models.sittingRequest,
                    as: 'sitting',
                    include: [
                        {
                            model: models.user,
                            as: 'user',
                        },
                        {
                            model: models.user,
                            as: 'bsitter',
                        },
                    ],
                },
            ],
        });
        res.send(list);
    } catch (err) {
        res.status(400);
        res.send(err);
    }
};

const getById = async (req, res) => {
    const id = req.params.id;
    try {
        const list = await models.feedback.findAll({
            where: {
                requestId: id,
            },
            include: [
                {
                    model: models.sittingRequest,
                    as: 'sitting',
                    include: [
                        {
                            model: models.user,
                            as: 'user',
                        },
                        {
                            model: models.user,
                            as: 'bsitter',
                        },
                    ],
                },
            ],
        });
        res.send(list);
    } catch (err) {
        res.status(400);
        res.send(err);
    }
};

const getAllFeedbackByUserId = async (req, res) => {
    const userId = req.params.id;

    try {
        const listFeedbacks = await models.feedback.findAll({
            include: [
                {
                    model: models.sittingRequest,
                    where: { acceptedBabysitter: userId },
                    as: 'sitting',
                    include: [
                        {
                            model: models.user,
                            as: 'user',
                        },
                    ],
                },
            ],
        });

        res.send(listFeedbacks);
    } catch (error) {
        res.status(400);
        res.send(error);
    }
};

const create = async (req, res) => {
    let newItem = req.body;

    try {
        const newFeedback = await models.feedback
            .create(newItem)
            .then((res) => {
                //tìm sitting request từ requestid của feedback
                const sitting = models.sittingRequest
                    .findAll({
                        where: {
                            id: res.requestId,
                        },
                    })
                    .then((res) => {
                        ///tìm acceptedbabsitter
                        const bsitter = models.babysitter
                            .findAll({
                                where: {
                                    userId: res[0].acceptedBabysitter,
                                },
                            })
                            .then((resp) => {
                                //lấy rating + feedback của babysitter đó rồi tính toán
                                let rating = resp[0].averageRating;
                                let feedback = resp[0].totalFeedback;
                                rating =
                                    (rating * feedback + newItem.rating) /
                                    (feedback + 1);
                                feedback += 1;

                                const babysitterBody = {
                                    totalFeedback: feedback,
                                    averageRating: rating,
                                };
                                //update vào database
                                const updateBsitter = models.babysitter.update(
                                    babysitterBody,
                                    {
                                        where: {
                                            userId: resp[0].userId,
                                        },
                                    },
                                );
                            });
                        ///
                    });
            });
        res.send(newFeedback);
    } catch (err) {
        res.status(400);
        res.send(err);
    }
};

const update = async (req, res) => {
    const id = req.params.id;
    const updatingFeedback = req.body;

    try {
        await models.feedback.update(updatingFeedback, {
            where: {
                id: id,
            },
        });
        res.send(updatingFeedback);
    } catch (err) {
        res.status(422);
        res.send(err);
    }
};

export default {
    list,
    create,
    getById,
    update,
    getAllFeedbackByUserId,
};
