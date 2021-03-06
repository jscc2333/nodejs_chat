const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const methodOverride = require('method-override');
const serveStatic = require('serve-static');
var path = require('path');
const User = require('./models/userModel');
const Avatar = require('./models/avatarModel');
const avatarSrc = '67.216.200.85:3000/assets/avatar/';
// 利用mongoose连接到数据库
mongoose.Promise = global.Promise;
mongoose.connect('mongodb://67.216.200.85:27017/userdb');
var db = mongoose.connection;

// 设置返回消息的格式
let output = function (status, data, info) {
  return JSON.stringify({
    status: status,
    data: data,
    info: info
  });
};

let detection = function (username, socket) {
  let clock = 0;
  socket.emit('detection', clock);
  let prevcount = -10;
  let currcount = 0;
  let timer = setInterval(() => {
    prevcount += 1;
    if (prevcount === currcount) {
      clearInterval(timer);
      User.update({
        username:username
      }, {
          $set: {is_online:false}  
        }, (err) => { 
          if (err) { 
            console.log(err);
          }
        })
    }
  }, 15000)
  socket.on('detection', (data) => {
    currcount = data;
    setTimeout(() => {
      socket.emit('detection', data);
    }, 15000);
  })
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
  res.redirect('/index.html');
});

io.on('connection', (socket) => {
  socket.on('disconnect', (socket) => {
    console.log(socket);
  })
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
                detection(users[0].username, socket);
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
  // 获取用户头像
  socket.on('fetchAvatar', (user) => {
    User.find({
      username: user.username
    }, (err, user) => {
      if (err) {
        console.log(err);
      } else {
        socket.emit('provAvatar', user[0].avatar)
      }
    })
  })
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
    }, (err, user) => {
      if (err) {
        console.log(err);
      } else {
        let data = {
          avatar: user[0].avatar,
          information: user[0].information
        };
        socket.emit('provOtherInformation', data);
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
  // 获取头像列表
  socket.on('fetchAvatarList', () => {
    Avatar.find({}, (err, avatar) => {
      if (err) {
        console.log(err);
      } else {
        socket.emit('provAvatarList', avatar);
      }
    })
  })
  // 更新头像
  socket.on('changeAvatar', (data) => {
    User.update({
      username: data.username
    }, {
      $set: {
        avatar: data.avatar
      }
    }, (err) => {
      if (err) {
        console.log(err);
      } else {
        socket.emit('updateAvatarSuccessful', data.avatar);
      }
    })
  })
});

http.listen(3000, () => {
  console.log('listening on localhost:3000');
});