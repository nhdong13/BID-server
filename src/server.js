import compression from 'compression';
import bodyParser from 'body-parser';
import cors from 'cors';
import morgan from 'morgan';

import routes from '@routes';
import models from '@models';
import { checkEnvLoaded } from '@utils/env';
import { insertDatabase } from '@utils/bootstrap';

const app = require('express')();
const server = require('http').createServer(app);
const io = require('socket.io')(server);

async function main() {
    try {
        checkEnvLoaded();

        // Init DB
        try {
            models.sequelize.authenticate();
            models.sequelize.sync({ force: true }).then(() => {
                insertDatabase();
            });
        } catch (dbError) {
            console.error('DB Error: ', dbError);
            process.exit(1);
        }

        // Compression gzip
        app.use(compression());

        // Body parseer
        app.use(bodyParser.urlencoded({ extended: false }));
        app.use(bodyParser.json());

        // CORS
        const corsOptions = {
            origin: '*',
            optionsSuccessStatus: 200,
        };
        app.use(cors(corsOptions));

        // Middlewares
        app.use(morgan('dev'));

        // Init roues
        app.use('/api/v1', routes);

        const qr = io.of('/api/v1/qr').on('connection', (socket) => {
            socket.on('qrscanning', (data) => {
                console.log('PHUC: main -> data', data);

                qr.emit('qrTrigger', { qr: data });
            });
        });

        // app.listen(5000, function() {
        //     console.log('App is listening on port 5000!');
        // });

        server.listen(5000, () => {
            console.log('App is running at port 5000');
        });
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

main();
