
// Database 
const database = require('./database')

// Node Schedule
const schedule = require('node-schedule-tz')

// File system
const fs = require('fs')
const path = require('path')

// Axios Request
const request = require('./request')

// Components
const robot = require('./robot.js')
const utils = require('./utils')

// Express JS
const express = require('express')
const app = express()

// Conf 
const conf = require('./conf')

// Set CROS
app.all('*', function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Credentials", "true")
  res.header("Access-Control-Allow-Headers", "X-Requested-With")
  res.header("Access-Control-Allow-Methods","PUT,POST,GET,DELETE,OPTIONS")
  res.header("X-Powered-By",' 3.2.1')
  //res.header("Content-Type", "application/json;charset=utf-8")
  next()
})

// Start HTTP server
let server = app.listen(8003, function () {
  let host = server.address().address;
  let port = server.address().port;
  console.log('Your App is running at http://%s:%s', host, port);
})


// Main Data
app.get('/', async function (req, res) {

    let data = fs.readFile(path.join(__dirname, 'data/data.json'), 'utf-8', (err, data)=>{
      if(err){
        res.send('an error occur, try again')
        updateData()
      } else {
        res.send(data)
      }
      return
    })
    
})

// Get locations center
app.get('/locations', async function (req, res) {
  let data = fs.readFile(path.join(__dirname, 'data/locations.json'), 'utf-8', (err, data)=>{
    if(err){
      res.send('an error occur, try again')
      putLocation()
    } else {
      res.send(data)
    }
    return
  })
})


// Get history data
app.get('/history', async function (req, res) {
  let data = fs.readFile(path.join(__dirname, 'data/history.json'), 'utf-8', (err, data)=>{
    if(err){
      res.send('an error occur, try again')
      putHistory()
    } else {
      res.send(data)
    }
    return
  })
})

// Approve shadow data become official data
app.get('/approve', async function (req, res) {

  let token = await database.getApproveToken()

  token = token.data.token

  if(req.query.token != token){

    res.send("not allow")
    return 

  } else {
    database.updateApprove()
    updateData()
    res.send(JSON.stringify({status: true, data: null}))
    return
  }
})

// Go to visual
app.get('/visual', async function (req, res) {
  res.sendFile(path.join(__dirname, 'visual/index.html'))
})

// On create
updateData()
putHistory()
putLocation()

async function getLocations(){

  const mapboxAPI = conf.getMapbox().api
  const mapboxToken = conf.getMapbox().token

  let data = await database.current()
  let area = JSON.parse(data.data[0].area)

  let geo = await database.locations()

  if(geo){

    area.forEach(async el => {
      // If doesnt exist
      
      if(utils.idIdxsInArrWithId(el.location, geo.data, 'name') == -1){
        
        let loca = encodeURI(el.location)
        
        await request.genGet(mapboxAPI+ loca +".json", [{name: "access_token", val: mapboxToken}], (res)=>{
          if(res.status){
            let center = res.data.features[0].center
            
            let confirm = parseInt(el.number) ? parseInt(el.number) : el.number.split(" ")[0]
            let ready = {
              name: el.location,
              lo: center[0],
              la: center[1]
            }
  
            database.addLocation(ready)

          }
        })
      }
    })
  }
  
}



// Update data
async function updateData(){

  let update = await robot.getData()

  setTimeout(async()=>{
    if(update){
      let data = await database.current()
      if(data){
        fs.writeFile(path.join(__dirname, 'data/data.json'), JSON.stringify(data), ()=>{
          // Do nothing
        })
      }
      // Get newer updated location data
      getLocations()
    }
  }, 10000)
  
}


// Put data into history json
async function putHistory(){
  let data = await database.history()
  if(data){
    fs.writeFile(path.join(__dirname, 'data/history.json'), JSON.stringify(data), ()=>{
      return true
    })
  }
}

async function putLocation(){
  let data = await database.locations()
  if(data){
    fs.writeFile(path.join(__dirname, 'data/locations.json'), JSON.stringify(data), ()=>{
      return true
    })
  }
}


// Schedule Tasks
var updateAll = schedule.scheduleJob('updateall', '01 * * * *', 'Europe/London', function(){
  updateData()
  setTimeout(()=>{
    database.autoApprove()
  }, 20000)
  return
})

var recordHistory = schedule.scheduleJob('history', '10 50 23 * * *', 'Europe/London', async function(){
  let save = await database.saveHistory()
  if(save){
    putHistory()
  }
  return
})
