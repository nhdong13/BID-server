export default function(sequelize, DataTypes) {
    const babysitter = sequelize.define(
        "babysitter", // Model Name
        {
            userId: {
                type: DataTypes.INTEGER,
                primaryKey: true
            },
            // available date in a week MON-SUN ex: "MON,TUE,FRI"
            weeklySchedule: {
                type: DataTypes.STRING,
                allowNull: true
            },
            startTime: {
                type: DataTypes.STRING,
                allowNull: true
            },
            endTime: {
                type: DataTypes.STRING,
                allowNull: true
            },
            minAgeOfChildren: {
                type: DataTypes.INTEGER,
                allowNull: false
            },
            maxNumOfChildren: {
                type: DataTypes.INTEGER,
                allowNull: false
            },
            averageRating: {
                type: DataTypes.FLOAT,
                allowNull: true
            },
            totalFeedback: {
                type: DataTypes.INTEGER,
                allowNull: true
            },
            distance: DataTypes.VIRTUAL,
            isInvited: DataTypes.VIRTUAL,
            workFor: DataTypes.VIRTUAL,
        },
        {
            timestamps: true,
            charset: "utf8",
            collate: "utf8_general_ci",
        }
    );

    babysitter.associate = function(models) {
        // user - babysitter
        babysitter.belongsTo(models.user, {
            foreignKey: "userId",
            sourceKey: "id",
            as: "user"
        });

    };

    return babysitter;
}
