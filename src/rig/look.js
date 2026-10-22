// 人物外观：全片固定一个形象，不随年龄变化。
// 一套服装：白 T 恤 + 敞开的黑色夹克 + 深色牛仔裤 + 白色运动鞋；脖子上始终挂红色头戴式耳机。
// 头部用 assets/heads/three-quarter.png（见 head.js），没有素材时画原创占位头。
// skin 与头像亮部肤色一致，skinShade 与头像暗部一致。
export const LOOK = {
  build: 1.0,
  posture: 0.005,
  hair: 'short', hairVol: 0.88, // 只用于占位头
  outfit: 'jacket',
  shoes: 'sneaker',
  bounce: 1.0,
  armK: 1.0,
  colors: {
    skin: '#f9c7a0', skinShade: '#e2a47e',
    top: '#f4f1ea', outer: '#24272e', outer2: '#33373f',
    pants: '#34405a', shoe: '#f2f0ea', sole: '#cfc9bc', hair: '#1b1918',
  },
};
