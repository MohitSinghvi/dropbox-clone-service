const express = require('express');
const app = express();
const { v4: uuidv4 } = require('uuid');

const cors = require('cors');

// const fileparser = require('./fileparser');


const multer = require('multer');
const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.S3_REGION, // Change this to your desired AWS region
});

const s3 = new AWS.S3();

// Configure Multer for file upload
const storage = multer.memoryStorage();
const upload = multer({ storage });


const https = require('https');


require('dotenv').config();

app.use(function(req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', true);
  next();
});

app.use(cors());



const port = 8000;
app.listen(port, () => {
  console.log('Listening on port ' + port);
});

app.get('/', (req, res) => res.send('My first Node API!'));


var mysql = require('mysql');
var con = mysql.createConnection({
    host     : 'dropbox-clone.cc6hzksuc4aq.us-west-1.rds.amazonaws.com',
    user     : 'admin',
    password : 'admin123',
    database : 'dropbox'
});

con.connect(function(err) {
    if (err) throw err;
    console.log("Connected!");
    
  });

app.get('/files', 
    (req, res) => {

      var appendString = '';
      if(req.query.userId){
        appendString = ' where userId = "'+req.query.userId+'"';
      }
        con.query('SELECT * from Files'+appendString, function (err, result) {
            if (err) throw err;
            // console.log("Result: " + result);
            return res.status(200).json({ body: result });
            // return res.send({
            //     statusCode: 200,
            //     body: result,
            // });
          });
    }
);

app.post('/upload', upload.single('file'), (req, res) => {
    const file = req.file;
    const userId = req.body.userId
    const description = req.body.description;
    const firstname = req.body.firstname
    const lastname = req.body.lastname;
    
    const fileId = req.body.fileId;
    const randomUUID = uuidv4();
  
    if (!file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    const params = {
      Bucket: process.env.S3_BUCKET,
      Key: userId+'/'+file.originalname,
      Body: file.buffer,
    };
    try{

      if(fileId){
        const deleteParams = {
          Bucket: process.env.S3_BUCKET,
          Key: userId+'/'+file.originalname,
        } 
        s3.deleteObject(deleteParams, (err, data) => {
          if (err) {
            console.error('Error deleting file:', err);
            return res.status(500).json({ error: 'Error deleting file' });
          }
          else {
            s3.upload(params, (err, response) => {
              if (err) {
                res.status(500).json({ error: err.message });
              } else {


                const currentDate = new Date();
                const formattedDate = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${currentDate.getDate().toString().padStart(2, '0')}`;

                con.query('update Files set fileName = ?, fileDescription = ?, dateUpdated = ? where fileId = ?',[file.originalname,description,formattedDate, fileId] ,function (err, result) {
                  if (err){
                    res.send(JSON.stringify({
                      statusCode: 500,
                      body: JSON.stringify(err),
                  }));
                  } else {
                    console.log("Result: " + result);
                    return res.status(200).json({ message: 'File Updated successfully.', id: fileId });
                  }
                });
              }
            });
          }
        });

      } else {
        s3.upload(params, (err, data) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          const currentDate = new Date();
          const formattedDate = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${currentDate.getDate().toString().padStart(2, '0')}`;
          con.query('insert into Files values (?,?,?,?,?,?, ?, ?)',[randomUUID,file.originalname,description,userId ,formattedDate,null, firstname, lastname] ,function (err, result) {
            if (err) res.send(JSON.stringify({
                statusCode: 500,
                body: JSON.stringify(err),
            }));
            return res.status(200).json({ message: 'File uploaded successfully.', id: randomUUID });
          });
        });
      }
    } catch(error){
        console.log(error);
    }
  

  });


  app.get('/download/:key', (req, res) => {
    const key = req.params.key; // The key (filename) of the S3 object to download
    const userId = req.query.userId;
    const params = {
      Bucket: process.env.S3_BUCKET,
      Key: userId +'/' +key,
    };
    try{
      // let s3Stream = https.get('https://dpvploqw9ct29.cloudfront.net/'+key).createReadStream();
      /*
      let request = https.get('https://dpvploqw9ct29.cloudfront.net/'+key, (res) => {
        if (res.statusCode !== 200) {
          console.error(`Did not get an OK from the server. Code: ${res.statusCode}`);
          res.resume();
          return;
        }
      
        let data = '';
      
        res.on('data', (chunk) => {
          data += chunk;
        });
      
        res.on('close', () => {
          // console.log('Retrieved all data');
          // console.log(JSON.parse(data));
          response.send(data);
        });
        // response.send(data);
      });

  */
  res.setHeader('Content-Disposition', `attachment; filename="${key}"`);
        // res.setHeader('Content-Type', 'application/octet-stream'); // You may need to set the correct MIME type based on your file
      https.get(process.env.CLOUD_FRONT_URL+key,(response)=> {
        response.pipe(res);
      });
      
        // const s3Stream = s3.getObject(params).createReadStream();
    
        // // Set the appropriate response headers
        // res.setHeader('Content-Disposition', `attachment; filename="${key}"`);
        // res.setHeader('Content-Type', 'application/octet-stream'); // You may need to set the correct MIME type based on your file
    
        // Pipe the S3 stream to the response object
        // s3Stream.pipe(res);
    } catch(error){
        console.log(error);
    }
  });

app.delete('/delete/:key', (req, res) => {
    const key = req.params.key; // The key (filename) of the S3 object to delete
    const userId = req.query.userId;
    const params = {
      Bucket: process.env.S3_BUCKET,
      Key: userId+'/'+key,
    };
  
    s3.deleteObject(params, (err, data) => {
      if (err) {
        console.error('Error deleting file:', err);
        return res.status(500).json({ error: 'Error deleting file' });
      }

      con.query('delete from Files where fileName="'+key+'"', function (err, result) {
        if (err) return res.status(500).json({ error: 'Error deleting file' });
        // console.log("Result: " + result);
        // res.send({
        //     statusCode: 200,
        //     body: result,
        // });
      });
  
      res.status(200).json({ message: 'File deleted successfully' });
    });
  });






