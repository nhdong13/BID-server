export default function(sequelize, DataTypes) {
    const sittingRequestCriteria = sequelize.define(
        'sittingRequestCriteria', // Model Name
        {
            requestId: {
                type: DataTypes.INTEGER,
                unique: 'compositeIndex',
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
            },
            weight: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
        },
        {
            timestamps: true,
            charset: 'utf8',
            collate: 'utf8_general_ci',
        },
    );

    // sittingRequestSkill.associate = function(models) {
    //     sittingRequestSkill.belongsTo(models.sittingRequest, {
    //         foreignKey: {
    //             name: 'requestId',
    //             allowNull: false,
    //         },
    //         sourceKey: 'id',
    //         as: 'sittingRequest',
    //         onDelete: 'CASCADE',
    //     });
    // };

    return sittingRequestCriteria;
}