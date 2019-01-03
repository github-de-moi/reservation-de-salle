
import * as express from "express";
import * as bodyParser from "body-parser";
import { g3t, Reservation, cr3ate, upd4te, d3lete, exp0rt, imp0rt, prefs_get, prefs_set, isUuid, purg3, isIsoDate } from "./storage";
import { isObject } from "util";

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
    // TODO jeter une exception si données invalides
    let result = new Reservation(json.date, json.debut, json.fin, json.par_qui);
    if(json.id && isUuid(json.id)) {
        (result as any).id = json.id;
    }
    // le commentaire est optionnel
    result.commentaire = json.commentaire;
    return result;
};

//                  _           
//  _ _  ___  _ _ _| |_ ___  ___
// | '_>/ . \| | | | | / ._><_-<
// |_|  \___/`___| |_| \___./__/
// 

app.get('/', function (req, res) {
    
    // compatibilité avec le json feed ^^
    // https://fullcalendar.io/docs/events-json-feed

    if(req.query.start && !isIsoDate(req.query.start.substr(0, 10))) {
        res.status(400);
        res.send("Argument 'start' incorrect");
        return;
    }

    if(req.query.end && !isIsoDate(req.query.end.substr(0, 10))) {
        res.status(400);
        res.send("Argument 'end' incorrect");
        return;
    }

    res.send( g3t(req.query.start, req.query.end) );
});

app.post('/', function (req, res) {

    let ids: string[] = [];

    // req.body contient le json uploadé
    if(isObject(req.body)) {
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
        // et le persiste "en base"
        upd4te( unmarshaller(req.body) );
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
            console.log('Cleaned up ' + purg3() + ' items')
        }, 24*60*60*1000); // every day

        // clean now
        console.log('Cleaned up ' + purg3() + ' items')
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
        exp0rt(true)
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