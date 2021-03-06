var express = require("express");
var app = express();
var cfenv = require("cfenv");
var bodyParser = require('body-parser')
var https = require("https")

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())

var cloudant, mydb;

/* Endpoint to greet and add a new visitor to database.
* Send a POST request to localhost:3000/api/visitors with body
* {
* 	"name": "Bob"
* }
*/
app.post("/api/visitors", function (request, response) {
  var userName = request.body.name;
  var doc = { "name" : userName };
  if(!mydb) {
    console.log("No database.");
    response.send(doc);
    return;
  }

			//======================call to get all NHL Teams===========================
			var options = {
        host: "statsapi.web.nhl.com",
        path: "/api/v1/teams",
        method: "GET",
        headers: {
        }
      }
      var reqTeams = https.request(options, function (resTeams) {
        var responseStringTeams = ""
  
        resTeams.on("teams", function (data) {
          responseStringTeams += data   // save all the data from response
        });
        resTeams.on("end", function () {
          console.log(responseStringTeams)
          var parsed = JSON.parse(responseStringTeams)
        });
      });
      for(var i = 0; i < parsed.teams.length; i++) {
        // insert the team as a document
        mydb.insert(parsed.teams[i], function(err) {
          if (err) {
            console.log('[mydb.insert] ', err.message);
            response.send("Error");
            return;
          }
        });
      }
      
      reqTeams.end();
      //============================================================================


  // insert the username as a document
  mydb.insert(doc, function(err, body, header) {
    if (err) {
      console.log('[mydb.insert] ', err.message);
      response.send("Error");
      return;
    }
    doc._id = body.id;
    response.send(doc);
  });
});

/**
 * Endpoint to get a JSON array of all the visitors in the database
 * REST API example:
 * <code>
 * GET http://localhost:3000/api/visitors
 * </code>
 *
 * Response:
 * [ "Bob", "Jane" ]
 * @return An array of all the visitor names
 */
app.get("/api/visitors", function (request, response) {
  var names = [];
  if(!mydb) {
    response.json(names);
    return;
  }

  mydb.list({ include_docs: true }, function(err, body) {
    if (!err) {
      body.rows.forEach(function(row) {
        if(row.doc.name)
          names.push(row.doc.name);
      });
      response.json(names);
    }
  });
});


/**
 * Endpoint to get all player stats in the NHL
 * REST API example:
 * <code>
 * GET http://localhost:3000/api/visitors
 * </code>
 *
 * Response:
 * [ "Bob", "Jane" ]
 * @return An array of all the visitor names
 */
app.get("/api/player_stats", function (request, response) {
  var names = [];
  if(!mydb) {
    response.json(names);
    return;
  }

  console.log("gets into the call");
      //======================call to get all NHL Teams===========================
      /*
			var options = {
        host: "statsapi.web.nhl.com",
        path: "/api/v1/teams",
        method: "GET",
        headers: {
        }
      }
      var reqTeams = https.request(options, function (resTeams) {
        var responseStringTeams = ""
  
        resTeams.on("data", function (data) {
          responseStringTeams += data   // save all the data from response
        });
        resTeams.on("end", function () {
          console.log(responseStringTeams)
         // var parsed = JSON.parse(responseStringTeams)
        });
      });
*/

      https.get('https://statsapi.web.nhl.com/api/v1/teams', (resp) => {
      let data = '';

        // A chunk of data has been recieved.
        resp.on('data', (chunk) => {
          data += chunk;
        });

        // The whole response has been received. Print out the result.
        resp.on('end', () => {
          console.log(JSON.parse(data).explanation);
        });

      }).on("error", (err) => {
        console.log("Error: " + err.message);
      });

      /*
      for(var i = 0; i < parsed.teams.length; i++) {
        // insert the team as a document
        mydb.insert(parsed.teams[i], function(err) {
          if (err) {
            console.log('[mydb.insert] ', err.message);
            response.send("Error");
            return;
          }
        });
      }
      */
      
      //============================================================================
  
  
     
  response.json(responseStringTeams);
});


// load local VCAP configuration  and service credentials
var vcapLocal;
try {
  vcapLocal = require('./vcap-local.json');
  console.log("Loaded local VCAP", vcapLocal);
} catch (e) { }

const appEnvOpts = vcapLocal ? { vcap: vcapLocal} : {}

const appEnv = cfenv.getAppEnv(appEnvOpts);

// Load the Cloudant library.
var Cloudant = require('@cloudant/cloudant');
if (appEnv.services['cloudantNoSQLDB'] || appEnv.getService(/cloudant/)) {

  // Initialize database with credentials
  if (appEnv.services['cloudantNoSQLDB']) {
    // CF service named 'cloudantNoSQLDB'
    cloudant = Cloudant(appEnv.services['cloudantNoSQLDB'][0].credentials);
  } else {
     // user-provided service with 'cloudant' in its name
     cloudant = Cloudant(appEnv.getService(/cloudant/).credentials);
  }
} else if (process.env.CLOUDANT_URL){
  cloudant = Cloudant(process.env.CLOUDANT_URL);
}
if(cloudant) {
  //database name
  var dbName = 'mydb';

  // Create a new "mydb" database.
  cloudant.db.create(dbName, function(err, data) {
    if(!err) //err if database doesn't already exists
      console.log("Created database: " + dbName);
  });

  // Specify the database we are going to use (mydb)...
  mydb = cloudant.db.use(dbName);
}

//serve static file (index.html, images, css)
app.use(express.static(__dirname + '/views'));



var port = process.env.PORT || 3000
app.listen(port, function() {
    console.log("To view your app, open this link in your browser: http://localhost:" + port);
});
