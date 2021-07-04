const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const io = require('socket.io')(server);
const Gpio = require('pigpio').Gpio;
const { Control } = require('magic-home');
const net = require("net")

const red = new Gpio(22, { mode: Gpio.OUTPUT })
const green = new Gpio(17, { mode: Gpio.OUTPUT })
const blue = new Gpio(24, { mode: Gpio.OUTPUT })
const white = new Gpio(25, { mode: Gpio.OUTPUT })

let light = new Control(
   "192.168.68.111",
   {
      apply_masks: true,
      cold_white_support: true,
      command_timeout: 0,
      ack: { power: true, color: true, pattern: true, custom_pattern: true }
   })

app.use(express.json());
app.use(express.urlencoded({
   extended: true
}));

app.get('/', (req, res) => {
   res.sendFile(__dirname + '/views/pages/index.html');
});

var connectedToWindows = false
var client = net.connect(54000, "192.168.1.64", (e) => {
   connectedToWindows = true
   console.log("Connect")
})

client.on("error", (err) => {
   console.log("Error: ", err)
})


io.on('connection', (socket) => {
   console.log('A user connected!')
   io.to(socket.id).emit('initialValues',
      {
         red: red.getPwmDutyCycle(),
         green: green.getPwmDutyCycle(),
         blue: blue.getPwmDutyCycle(),
         white: white.getPwmDutyCycle(),
      })

   socket.on('disconnect', () => {
      console.log('A user disconnected!')
   });

   var interval

   socket.on('change', function (values) {
      //console.log("ValueS: ", values)
      clearInterval(interval)
      if (values.cycle) {
         var r = 255, g = 0, b = 0;
         interval = setInterval(function () {
            if (r > 0 && b == 0) {
               r--;
               g++;
            }
            if (g > 0 && r == 0) {
               g--;
               b++;
            }
            if (b > 0 && g == 0) {
               r++;
               b--;
            }
            red.pwmWrite(r)
            green.pwmWrite(g)
            blue.pwmWrite(b)

            if (connectedToWindows) client.write(r + "," + g + "," + b + "*")
            if (values.lamp) {
               light.setColor(r, g, b)
                  .then(success => null)
                  .catch(err => null)
            }
         }, values.speed)
      } else {
         if (connectedToWindows) client.write(values.red + "," + values.green + "," + values.blue + "*")
         red.pwmWrite(values.red)
         green.pwmWrite(values.green)
         blue.pwmWrite(values.blue)
         white.pwmWrite(values.white)
         if (values.white > 0) {
            light.setWhites(0, values.white).then(success => {
               console.log("success: ", success)
            }).catch(err => {
               return console.log("Error:", err.message)
            })
         } else {
            light.setColor(values.red, values.green, values.blue).then(success => {
               console.log("success: ", success)
            }).catch(err => {
               return console.log("Error:", err.message)
            })
         }
      }
   })
})

server.listen(8000, () => {
   console.log('listening on *:8000')
})

red.pwmWrite(0)
green.pwmWrite(0)
blue.pwmWrite(0)
white.pwmWrite(0)
light.setColor(0, 0, 0).then(success => {
   //console.log("success: ", success)
}).catch(err => {
   //console.log("Error:", err.message)
})

app.get('/turnOnPc', function (req, res) {
   red.pwmWrite(0)
   green.pwmWrite(255)
   blue.pwmWrite(0)
   res.send("Done");
});