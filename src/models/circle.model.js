export default function(sequelize, DataTypes) {
    return sequelize.define(
        "circle", // Model Name
        {
            id: {
                type: DataTypes.INT,
                allowNull: false,
                unique: true
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false
            },
            createdAt: {
                type: DataTypes.DATE,
                defaultValue: DataTypes.NOW
            },
            updatedAt: {
                type: DataTypes.DATE,
                defaultValue: DataTypes.NOW,
                onUpdate: DataTypes.NOW
            }
        }
    );
}
