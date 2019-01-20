
import * as express from "express";
import * as bodyParser from "body-parser";

import { Reservation, Reservations, Preferences } from "./storage";
import { isUuid, isIsoDate } from "./helpers";
import { isObject, isNumber } from "util";

// imports
const cors = require('cors');
const app = express();

// config
const PORT = 3000;

// le stockage des données
const reservations: Reservations = new Reservations();
const prefs: Preferences = new Preferences();

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

    // TODO jeter une "exception" spéciale (genre IllegalArgument)
    // pour générer une erreur http 400 - bad argument

    // la date doit être au format iso (yyyy-mm-dd)
    if(!/^20[0-9]{2}\-[0-1][0-9]\-[0-3][0-9]$/.test(json.date)) {
        throw "Date incorrecte (aaaa-mm-jj attendu)"
    }

    // l'heure de début et de fin sont en minutes depuis minuit (valeur maxi 1439)
    if(!isNumber(json.debut) || json.debut < 0 || json.debut >= 1440) {
        throw "Heure de début incorrecte (moins de 1440 minutes)"
    }
    if(!isNumber(json.fin) || json.fin < 0 || json.fin >= 1440) {
        throw "Heure de fin incorrecte (moins de 1440 minutes)"
    }

    let result = new Reservation(isUuid(json.id) ? json.id : undefined, json.date, json.debut, json.fin, json.par_qui);
    
    // commentaire (optionnel)
    result.commentaire = json.commentaire || null;
    
    // gestion des répétitions (optionnel)
    result.groupId = isUuid(json.groupId) ? json.groupId : null;

    return result;
};

//                  _           
//  _ _  ___  _ _ _| |_ ___  ___
// | '_>/ . \| | | | | / ._><_-<
// |_|  \___/`___| |_| \___./__/
// 

// récupération des réservations
// paramètres optionnels :
// m pour le mois et y pour l'année
app.get('/', function (req, res) {
    
    // compatibilité avec le json feed ^^
    // https://fullcalendar.io/docs/events-json-feed

    if(req.query.start && !isIsoDate(req.query.start.substr(0, 10))) {
        res.status(400);
        res.send({error: "argument 'start' incorrect, date iso attendue"});
        return;
    }

    if(req.query.end && !isIsoDate(req.query.end.substr(0, 10))) {
        res.status(400);
        res.send({error: "argument 'end' incorrect, date iso attendue"});
        return;
    }

    res.send( reservations.find(req.query.start, req.query.end) );
});

app.get('/groups/:id', function (req, res) {
    if(!isUuid(req.params.id)) {
        res.status(400);
        res.send({error: "identifiant du groupe absent"});
        return;
    }
    res.send( reservations.all(req.params.id) );
});

// créé une nouvelle réservation
// renvoie l'id de l'instance créée
// et l'id de répétition si répétition
// (i.e. l'url contient ?repeat=nn) 
app.post('/', function (req, res) {

    // req.body contient le json uploadé
    if(!isObject(req.body)) {
        res.status(400);
        res.send({error: "données invalides, instance de Reservation attendue"});
        return;
    }

    // gestion des répétitions
    let reservation = reservations.create(unmarshaller(req.body));
    let result: any = {id: reservation.id};

    // le nombre de répétitions est passé en query string
    // on limite à 19 répétitions maxi, soit 20 instances en tout
    if(req.query.repeat && /^1?[0-9]/.test(req.query.repeat)) {
        let numRepeat = parseInt(req.query.repeat);
        for(let k=0; k<numRepeat; k++) {
            reservation = reservations.create(reservation.repeat());
        }
        // c'est le même sur toutes les instance ^^
        result.groupId = reservation.groupId;
    }
    res.send(result);

});

app.put('/:id', function (req, res) {
    // req.body contient le json uploadé
    if(isObject(req.body)) {
        // met à jour une instance ou tout le groupe
        // en fonction de la présence ou non de l'id de groupe
        reservations.update( unmarshaller(req.body) );
    } else {
        res.status(400);
        res.send({error: "données invalides, instance de Reservation attendue"});
    }

    res.send({});
});

app.delete('/:id', function (req, res) {
    reservations.remove(req.params.id);
    res.send({});
});

app.delete('/groups/:id', function (req, res) {
    reservations.removeGroup(req.params.id);
    res.send({});
});

app.get('/backup', function (req, res) {
    reservations.export().then((num) => {
        console.info('Saved ' + num + ' elements to backup file');
        res.send({"saved": num});
    }).catch((error) => {
        res.status(500);
        res.send(JSON.stringify(error));
    });
});

app.get('/prefs/:username', function (req, res) {
    let values = prefs.get(req.params.username);
    if(values) {
        res.send(values);
    } else {
        res.status(404);
        res.send({error: "pas de préférences stockées pour l'utilisateur " + req.params.username});
    }
});

app.put('/prefs/:username', function (req, res) {
    if(isObject(req.body)) {
        // TODO vérifier la validité des prefs (contenu, valeurs) avant de les sauvegarder
        prefs.set(req.params.username, req.body);
    }
    res.send({});
});

//                  _         _                        
// _ _  _ _ ._ _  | |_  ___ | |_  _ _   _ _  _ _ ._ _ 
// | '_>| | || ' | | . \<_> || . \| | | | '_>| | || ' |
// |_|  `___||_|_| |___/<___||___/`_. | |_|  `___||_|_|
//                                <___'                

// traitement des erreurs 
app.use(function(err, req, res, next) {
    console.error(err, err.stack);
    if (res.headersSent) {
        return next(err);
    }
    res.status(500);
    res.json({ error: err });
});
  
// https://stackoverflow.com/a/35999141
// TODO comment utiliser Promise.finally ?
reservations.import().then((num) => {
    
    console.info(num > 0 ? 'Loaded ' + num + ' elements from backup file':
        'No backup or empty file found, starting from scratch ...');

    let now = new Date();

    // à partir de ce soir à ~22h,     
    // purge toutes les nuits
    let tonight = new Date();
    tonight.setHours(22, 22, 22, 22);
    
    // effet de bord intéressant, si delta < 0,
    // le callback est exécuté immédiatement ^^ 
    let delta = (tonight.getTime() - now.getTime());
    
    console.log('Purge agent will run in ~ ' + Math.round(delta/1000/60/60) + ' hours (@ ' + tonight.toISOString() + ')');

    setTimeout(() => {
        console.log('Next purge will happen in ~ 1 day from now (' + (new Date()).toISOString() + ')');
        setInterval(() => {
            console.log('Cleaned up ' + reservations.purge() + ' items')
        }, 24*60*60*1000); // every day

        // clean now
        console.log('Cleaned up ' + reservations.purge() + ' items')
    }, delta);

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
        reservations.export(true)
            .then((num) => console.info('Saved ' + num + ' elements to backup file'))
            .catch((error) => console.error('Failed to backup data ...', error))
            .then(() => { console.log('Bye bye :\'('); process.exit(0); });
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