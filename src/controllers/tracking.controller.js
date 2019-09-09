import models from "@models";

const list = async (req, res, next) => {
    const listTrackings = await models.tracking.findAll();
    res.send(listTrackings);
};

const create = async (req, res) => {
    const newItem = req.body;

    try {
        const newTracking = await models.tracking.create(newItem);
        res.send(newTracking);
    } catch (err) {
        res.status(400);
        res.send(err);
    }
};

const read = async (req, res) => {
    const id = req.params.id;

    try {
        const tracking = await models.tracking.findOne({
            where: {
                id
            }
        });
        if (tracking) {
            res.status(201);
            res.send(tracking);
        } else {
            res.status(404);
            res.send();
        }
    } catch (err) {
        res.status(400);
        res.send(err);
    }
};

const update = async (req, res) => {
    const id = req.params.id;

    const updatingTracking = req.body;

    try {
        await models.tracking.update(updatingTracking, {
            where: { id }
        });
        res.send();
    } catch (err) {
        res.status(422);
        res.send(err);
    }
};

const destroy = async (req, res) => {
    const id = req.params.id;

    try {
        await models.tracking.destroy({
            where: {
                id
            }
        });
        res.status(204);
        res.send();
    } catch (err) {
        res.status(422);
        res.send(err);
    }
};

export default { list, create, read, update, destroy };
