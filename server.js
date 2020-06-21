var express = require('express');
var bodyParser = require('body-parser');
const aws = require('aws-sdk');
var pg = require('pg');

var app = express();

app.set('port', process.env.PORT || 5000);

app.use(express.static('public'));
app.use(bodyParser.json());

/*
 * Configure the AWS region of the target bucket.
 * Remember to change this to the relevant region.
 */
aws.config.region = 'us-east-1';

/*
 * Load the S3 information from the environment variables.
 */
const S3_BUCKET = process.env.S3_BUCKET;

app.get('/sign-s3', (req, res) => {
    const s3 = new aws.S3();
    const fileName = req.query['file-name'];
    const fileType = req.query['file-type'];
    const s3Params = {
      Bucket: S3_BUCKET,
      Key: fileName,
      Expires: 60,
      ContentType: fileType,
      ACL: "bucket-owner-full-control"
     // ACL: 'public-read'
    };
  
    s3.getSignedUrl('putObject', s3Params, (err, data) => {
      if(err){
        console.log(err);
        return res.end();
      }
      const params = {
        Bucket: S3_BUCKET, 
        Key: fileName,
        Expires: 600
      };
      
      const signedURL = s3.getSignedUrl('getObject', params);

      const returnData = {
        signedRequest: data,
        url: signedURL,
        key: fileName
        //url: `https://${S3_BUCKET}.s3.amazonaws.com/${fileName}`
      };
      res.write(JSON.stringify(returnData));
      res.end();
    });
  });
  

app.post('/update', function(req, res) {
    pg.connect(process.env.DATABASE_URL, function (err, conn, done) {
        // watch for any connect issues
        if (err) console.log(err);
        conn.query(
            'UPDATE salesforce.Contact SET Phone = $1, MobilePhone = $1 WHERE LOWER(FirstName) = LOWER($2) AND LOWER(LastName) = LOWER($3) AND LOWER(Email) = LOWER($4)',
            [req.body.phone.trim(), req.body.firstName.trim(), req.body.lastName.trim(), req.body.email.trim()],
            function(err, result) {
                if (err != null || result.rowCount == 0) {
                  conn.query('INSERT INTO salesforce.Contact (Phone, MobilePhone, FirstName, LastName, Email,external_email_id__c,Avator_Image__c ) VALUES ($1, $2, $3, $4, $5, $6,$7)',
                  [req.body.phone.trim(), req.body.phone.trim(), req.body.firstName.trim(), req.body.lastName.trim(), req.body.email.trim(), req.body.prefix.trim(), req.body.avatar_url.trim()],
                  function(err, result) {
                   // done();
                    if (err) {
                      done();
                        res.status(400).json({error: err.message});
                    }
                    else {
                        // this will still cause jquery to display 'Record updated!'
                        // eventhough it was inserted
                       // res.json(result);

                       conn.query('INSERT INTO salesforce.S3_File__c (Name, Related_Id__c, 	Contact__r__External_Email_ID__c ) VALUES ($1, $2, $2)',
                       [req.body.avatar_key.trim(), req.body.prefix.trim()],
                       function(err, result) {
                         done();
                         if (err) {
                           alert ('error');
                             res.status(400).json({error: err.message});
                         }
                         else {
                             // this will still cause jquery to display 'Record updated!'
                             // eventhough it was inserted
                             res.json(result);
                         }
                       });                  
     
                    }
                  });



                }
                else {
                    done();
                    res.json(result);
                }
            }
        );
    });
});

app.listen(app.get('port'), function () {
    console.log('Express server listening on port ' + app.get('port'));
});
