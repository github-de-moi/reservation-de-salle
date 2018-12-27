
import * as express from "express";
import * as bodyParser from "body-parser";
import { g3t, Reservation, cr3ate, upd4te, d3lete, exp0rt, imp0rt, prefs_get, prefs_set } from "./storage";
import { isArray, isObject } from "util";

const PORT = 3000;

const cors = require('cors');
const app = express();

//                 ___  _      
//  ___  ___ ._ _ | | '<_> ___ 
// / | '/ . \| ' || |- | |/ . |
// \_|_.\___/|_|_||_|  |_|\_. |
//                        <___'
//

// enable all CORS requests
app.use(cors())

// support application/json type post data
app.use(bodyParser.json());

// enable pre-flight
app.options('*', cors());

//  _         _                    
// | |_  ___ | | ___  ___  _ _  ___
// | . |/ ._>| || . \/ ._>| '_><_-<
// |_|_|\___.|_||  _/\___.|_|  /__/
//              |_|
//

// convertit un objet vanilla {} en bean
const unmarshaller = (json): Reservation => {
    return new Reservation(json.date, json.debut, json.fin, json.par_qui);
};

//                  _           
//  _ _  ___  _ _ _| |_ ___  ___
// | '_>/ . \| | | | | / ._><_-<
// |_|  \___/`___| |_| \___./__/
// 

app.get('/', function (req, res) {
    
    if(req.query.y && !req.query.y.match(/^20[0-9]{2}$/)) {
        res.status(400);
        res.send("Argument 'y' incorrect");
        return;
    }

    if(req.query.m && !req.query.m.match(/^[1-9]|1[0-2]$/)) {
        res.status(400);
        res.send("Argument 'm' incorrect");
        return;
    }

    let today = new Date();
    let year = req.query.y ? parseInt(req.query.y) : today.getFullYear();
    // /!\ les mois sont zero-based sur l'objet Date
    let month = req.query.m ? parseInt(req.query.m) : (today.getMonth() + 1); 
    res.send( g3t(year, month) );
});

app.post('/', function (req, res) {

    let ids: string[] = [];

    // req.body contient le json uploadé
    // on gère les envois unitaires et de masse ^^ 

    if(isArray(req.body)) {
        req.body.forEach(element => {
            ids.push( cr3ate(unmarshaller(element)).id );
        });
    } else if(isObject(req.body)) {
        ids.push( cr3ate(unmarshaller(req.body)).id );
    } else {
        res.status(400);
        res.send('Objet ou tableau attendu');
    }

    res.send(ids);
});

app.put('/:id', function (req, res) {
    // req.body contient le json uploadé
    // envois unitaires uniquement ici !
    if(isObject(req.body)) {
        // convertit un objet vanilla {} en bean
        let reservation = unmarshaller(req.body);
        (reservation as any).id = req.params.id;
        upd4te(reservation);
    } else {
        res.status(400);
        res.send('Objet attendu');
    }

    res.send({});
});

app.delete('/:id', function (req, res) {
    d3lete(req.params.id);
    res.send({});
});

app.get('/backup', function (req, res) {
    exp0rt().then((num) => {
        console.info('Saved ' + num + ' elements to backup file');
        res.send({"saved": num});
    }).catch((error) => {
        res.status(500);
        res.send(JSON.stringify(error));
    });
});

app.get('/prefs/:username', function (req, res) {
    let prefs = prefs_get(req.params.username);
    if(prefs) {
        res.send(prefs);
    } else {
        res.status(404);
        res.send('Pas de préférences stockées pour l\'utilisateur ' + req.params.username);
    }
});

app.put('/prefs/:username', function (req, res) {
    if(isObject(req.body)) {
        // TODO vérifier la validité des prefs (contenu, valeurs) avant de les sauvegarder
        prefs_set(req.params.username, req.body);
    }
    res.send({});
});

//                  _         _                        
// _ _  _ _ ._ _  | |_  ___ | |_  _ _   _ _  _ _ ._ _ 
// | '_>| | || ' | | . \<_> || . \| | | | '_>| | || ' |
// |_|  `___||_|_| |___/<___||___/`_. | |_|  `___||_|_|
//                                <___'                

// https://stackoverflow.com/a/35999141
// TODO comment utiliser Promise.finally ?
imp0rt().then((num) => {
    
    console.info(num > 0 ? 'Loaded ' + num + ' elements from backup file':
        'No backup or empty file found, starting from scratch ...');

}).catch((error) => {

    console.error('Unable to read backup file ... starting with no data :-S');
    console.error(error);

}).then(() => {

    let server = app.listen(PORT, () => {
        console.debug('Bound to tcp port ' + PORT);
        console.info('Here we go !');
    })

    let shutdown = () => {
        server.close();
        exp0rt(true)
            .then((num) => console.info('Saved ' + num + ' elements to backup file'))
            .catch(error => console.error('Failed to backup data ...'))
            .then(() => console.log('Bye bye :\'('));
    };

    process.on('SIGTERM', () => {
        console.info("\n" + 'SIGTERM signal received.');
        shutdown();
    });

    process.on('SIGINT', () => {
        console.info("\n" + 'SIGINT signal received.');
        shutdown();
    });

});

// EOF