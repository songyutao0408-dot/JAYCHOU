// 时间点写法（截图、接触表通用）：
//   12.5        成片第 12.5 秒
//   b:30        全局第 30 拍（0 起）
//   s03:5       第 3 站第 5 拍（1 起，可带小数，如 s03:5.5）
//   intro:9     Intro 第 9 拍；outro:17 Outro 第 17 拍
export function parseSpec(spec, info) {
  if (/^b:/.test(spec)) return { beat: parseFloat(spec.slice(2)), label: spec };
  const m = /^([a-z]+\d*):([\d.]+)$/.exec(spec);
  if (m) {
    const sec = info.sections.find((s) => s.id === m[1]);
    if (!sec) throw new Error(`没有这个段落：${m[1]}`);
    return { beat: sec.start + parseFloat(m[2]) - 1, label: spec };
  }
  return { t: parseFloat(spec), label: `${spec}s` };
}
