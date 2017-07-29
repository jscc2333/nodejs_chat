const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const methodOverride = require('method-override');
const serveStatic = require('serve-static');
var path = require('path');
const User = require('./models/userModel');

// 利用mongoose连接到数据库
mongoose.Promise = global.Promise;
mongoose.connect('mongodb://localhost:27017/userdb');
var db = mongoose.connection;

// 设置返回消息的格式
let output = function (status, data, info) {
  return JSON.stringify({
    status: status,
    data: data,
    info: info
  });
};

app.use((req, res, next) => {
  res.header('Content-Type', 'application/x-www-form-urlencoded');
  res.header('Content-Type', 'application/json');
  res.header('Content-Type', 'text/html;charset=utf-8');
  next();
});

app.use(bodyParser.urlencoded({
  extended: true
}))
  .use(methodOverride());
app.use(serveStatic(path.join(__dirname, '/public')));

app.get('/', (req, res) => {
  console.log('run to here');
  res.redirect('/index.html');
});

io.on('connection', (socket) => {
  // 响应登录事件
  socket.on('login', (user) => {
    User.find({
      'username': user.username
    }, (err, users) => {
      if (err) {
        console.log(err);
      } else {
        if (!users.length) {
          // 用户长度为0
          socket.emit('loginMsg', output(false, null, '用户名不存在，请注册'));
        } else {
          // 用户名密码不正确
          if (users[0].password !== user.password) {
            socket.emit('loginMsg', output(false, null, '密码错误，请重试'));
          } else if (users[0].is_online) {
            // 用户已经在线
            socket.emit('loginMsg', output(false, null, '当前账户已在线，请勿重新登录'));
          } else {
            // 更新用户在线状态
            User.update({
              username: user.username
            }, {
              $set: {
                is_online: true
              }
            }, (err) => {
              if (err) {
                console.log(err);
              } else {
                socket.emit('loginMsg', output(true, {
                  username: users[0].username
                }, '登录成功'));
              }
            });
          }
        }
      }
    });
  });
  // 响应注册事件
  socket.on('regist', (user) => {
    User.find({
      'username': user.username
    }, (err, users) => {
      let temp = user;
      if (err) {
        console.log(err);
      } else {
        if (users.length) {
          // 用户名已存在
          socket.emit('registMsg', output(false, null, '用户名已存在，请更换用户名'));
        } else {
          // 注册用户基本信息
          let data = {
            username: temp.username,
            password: temp.password,
            is_online: false
          };
          let user = new User(data);
          user.save((err) => {
            if (err) {
              socket.emit('registMsg', output(false, null, '用户注册失败'));
            } else {
              socket.emit('registMsg', output(true, {
                username: user.username
              }, '用户注册成功'));
            }
          });
        }
      }
    });
  });
  // 响应获取在线用户列表事件
  socket.on('fetchList', (user) => {
    User.find({
      'is_online': true,
      'username': {
        '$ne': user.username
      }
    }, {
      'username': 1
    }, (err, users) => {
      if (err) {
        console.log(err);
      } else {
        // 发布在线列表事件
        socket.emit('provList', users);
      }
    });
  });

  socket.on('iamOnline', (user) => {
    // 用户上线广播给其他用户
    socket.broadcast.emit('someoneOnline', user);
  });

  socket.on('iamOffline', (user) => {
    // 用户下线广播给其他用户，并更新在线状态
    User.update({
      username: user.username
    }, {
      $set: {
        is_online: false
      }
    }, (err) => {
      if (err) {
        console.log(err);
      } else {
        socket.broadcast.emit('someoneOffline', user);
      }
    });
  });

  socket.on('sendMessage', (data) => {
    // 发送消息事件
    socket.broadcast.emit('broadMessage', data);
  });

  socket.on('fetchInformation', (username) => {
    // 查看消息事件
    User.find({
      username: username
    }, (err, userInfo) => {
      if (err) {
        console.log(err);
      } else {
        socket.emit('provInfo', userInfo);
      }
    });
  });

  socket.on('fetchOtherInformation', (username) => {
    User.find({
      username: username
    }, (err, userInfo) => {
      if (err) {
        console.log(err);
      } else {
        console.log(userInfo);
        socket.emit('provOtherInformation', userInfo[0].information);
      }
    });
  });

  socket.on('updateInformation', (data) => {
    User.update({
      username: data.username
    }, {
      $set: {
        information: {
          Autograph: data.Autograph,
          Sex: data.Sex,
          Age: data.Age,
          Area: data.Area,
          Career: data.Career,
          Like: data.Like
        }
      }
    }, (err) => {
      if (err) {
        console.log(err);
      } else {
        socket.emit('updateInfoSuccessful');
      }
    });
  });

  socket.on('updateBaseInformation', (data) => {
    User.update({
      username: data.username
    }, {
      $set: {
        password: data.password
      }
    }, (err) => {
      if (err) {
        console.log(err);
      } else {
        socket.emit('updateBaseInfoSuccessful');
      }
    });
  });
});

http.listen(3000, () => {
  console.log('listening on localhost:3000');
});
