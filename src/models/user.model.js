export default function (sequelize, DataTypes) {
    const user = sequelize.define(
        "user", // Model Name
        {
            phoneNumber: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true
            },
            email: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true
            },
            password: {
                type: DataTypes.STRING,
                allowNull: false
            },
            nickname: {
                type: DataTypes.STRING,
                allowNull: false
            },
            address: {
                type: DataTypes.STRING,
                allowNull: false
            },
            isAdmin: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
                allowNull: false
            },
        },
        {
            timestamps: true,
        }
    );

    user.associate = function (models) {
        models.user.hasMany(models.sittingRequest, {foreinKey: 'createdUser', sourceKey: 'id'});
    }

    return user;
}
