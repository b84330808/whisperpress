'use strict';
// Lines whisper makes up over silence or music: video outros and subtitle credits it
// learned from its training data. Only phrases nobody says in a real meeting are
// listed (no plain "thanks for watching"), in Traditional and Simplified script.
const PATTERNS = [
  /請不吝|请不吝/,
  /點[讚贊]\s*訂閱|点赞\s*订阅/,
  /訂閱\s*轉發|订阅\s*转发/,
  /明[鏡镜][與与]點點|明镜与点点|點點欄目|点点栏目/,
  /字幕(由|提供|志願者|志愿者|製作|制作)|中文字幕\s*by|字幕\s*by/i,
  /amara\.org/i,
  /ご視聴ありがとうございました/,
];

function isHallucination(text) {
  const s = (text || '').trim();
  return !!s && PATTERNS.some((re) => re.test(s));
}

module.exports = { isHallucination };
