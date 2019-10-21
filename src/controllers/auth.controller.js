import models from '@models';
import { createJWT } from '@utils/jwt';
import { comparePassword } from '@utils/hash';

const login = async (req, res) => {
    const { phoneNumber, password } = req.body;
    try {
        const user = await models.user.findOne({
            where: {
                phoneNumber,
            },
        });

        if (user) {
            const isValid = await comparePassword(password, user.password);

            if (isValid) {
                const token = createJWT(user.id, user.roleId);
                res.send({ token, roleId: user.roleId, userId: user.id });
            } else {
                res.status(400);
                res.send();
            }
        } else {
            res.status(400);
            res.send();
        }
    } catch (err) {
        res.status(400);
        res.send(err);
    }
};

export default { login };
