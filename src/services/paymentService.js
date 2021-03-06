import models from '@models/';

const stripe = require('stripe')('sk_test_ZW2xmoQCisq5XvosIf4zW2aU00GaOtz9q3');

const createCharges = async (req, res) => {
    const { amount, userId, requestId } = req.body;
    try {
        const result = await models.tracking.findOne({
            where: { userId },
        });
        // console.log('PHUC: createCharges -> result', result.customerId);

        const charge = await stripe.charges.create({
            amount: amount,
            currency: 'vnd',
            customer: result.customerId,
        });
        // console.log('PHUC: createCharges -> charge', charge);
        if (charge) {
            const { id: chargeId } = charge;
            // console.log('PHUC: createCharges -> chargeId', chargeId);
            const newTransaction = {
                chargeId,
                type: 'CHARGE',
                description: 'customer_pay_sittingrequest',
                userId: userId,
                requestId: requestId,
                amount: amount,
            };
            // luu charge vao bang transaction
            if (newTransaction) {
                await models.transaction.create(newTransaction);
                res.send(charge);
            }
        }
    } catch (error) {
        res.status(400);
        res.send(error);
    }
};

const createCustomer = async (req, res) => {
    const { email, token, userId, name, cardId } = req.body;

    try {
        const { id: customerId } = await stripe.customers.create({
            source: token,
            email: email,
            name: name,
        });

        await models.tracking.update(
            { customerId: customerId, cardId: cardId },
            {
                where: { userId },
            },
        );
        res.send({ customerId });
    } catch (error) {
        res.status(400);
        res.send(error);
    }
};

const getCustomerCard = async (req, res) => {
    const userId = req.body.userId;

    try {
        if (userId) {
            const tracking = await models.tracking.findOne({
                where: { userId },
            });
            const { customerId, cardId } = tracking;

            if (customerId && cardId) {
                const data = await stripe.customers
                    .retrieveSource(customerId, cardId)
                    .catch((error) =>
                        console.log('PHUC: getCustomer -> error', error),
                    );

                res.send(data);
            }
        } else {
            res.status(404);
            res.send();
        }
    } catch (err) {
        res.status(400);
        res.send(err);
    }
};

export default { createCharges, createCustomer, getCustomerCard };
