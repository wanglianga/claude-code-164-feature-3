/* 夜间限制 / 噪声记录冒烟断言：esbuild 打包后在 Node 直接执行（无 DOM 依赖） */
import {
  useState, createBooking, payDeposit, resolveNoise, resolveNoiseUnverified,
  reportIncident, setNoiseLightOff, noiseRecordOfIncident
} from '../src/store'
import {
  teamRestriction, nightDeposit, slotBlockedByNight, platformEndTime,
  nightRestrictionEffect, lightQuote
} from '../src/lib/engine'
import { COURTS } from '../src/data/mock'

let pass = 0
function assert(cond: unknown, msg: string) {
  if (!cond) {
    console.error(`❌ 断言失败：${msg}`)
    process.exit(1)
  }
  pass++
  console.log(`✅ ${msg}`)
}

const state = useState()
const court3 = COURTS.find(c => c.id === 'court-3')!
const court1 = COURTS.find(c => c.id === 'court-1')!

// ---- 1. 90 天窗口按队长手机号归并违规 ----
const rZhou = teamRestriction('137****2201', state.noiseRecords)
assert(rZhou.level === 1 && rZhou.violations === 2, '散客联队（周浩）历史 2 次核实违规 → L1 押金上浮（今晚工单未办结不计入）')

const rGao = teamRestriction('131****5566', state.noiseRecords)
assert(rGao.level === 2 && rGao.violations === 3, '夜鹰队（高夜）历史 3 次核实违规 → L2 押金上浮+限时段')

const rBao = teamRestriction('135****6677', state.noiseRecords)
assert(rBao.level === 1 && rBao.violations === 2, '夜豹队（鲍越）历史 2 次核实违规 → L1 押金上浮')

// NR-104 未核实成立，不计违规
assert(rGao.records.some(r => r.outcome === 'unverified'), '未核实投诉仍留在记录中可向居民公示，但不计违规')

// ---- 2. 押金分级与时段限制 ----
assert(nightDeposit(50, 0) === 50 && nightDeposit(50, 1) === 75 && nightDeposit(100, 2) === 150,
  '夜间限制押金：半场 50→75、全场 100→150（上浮 50%）')
assert(slotBlockedByNight('20:00', rGao) === false && slotBlockedByNight('20:30', rGao) === true,
  'L2：20:00 结束可约、20:00 后结束禁用；L1 不禁时段（22:00 可约）')
assert(slotBlockedByNight('22:00', rBao) === false, 'L1 只上浮押金，不限制时段')

// ---- 3. 平台统一结束（关灯离场）时间 ----
assert(platformEndTime({ start: '21:00', end: '22:30' }, court3) === '22:00',
  '河滨球场 21:00–22:30 夜场统一 22:00（静音截止）关灯离场')
assert(platformEndTime({ start: '20:00', end: '22:00' }, court1) === '21:00',
  'A区 20:00–22:00 夜场统一 21:00（静音截止）关灯离场')
assert(platformEndTime({ start: '18:00', end: '20:00' }, court1) === '20:00',
  '在静音截止前结束的场次，结束时间不变（20:00）')

// ---- 4. 预约：L1 队长预约即适用上浮押金并写入告知时间线 ----
const bBao = createBooking({
  courtId: 'court-2', halves: ['H1'], scope: 'half', start: '20:00', end: '22:00',
  headcount: 5, acceptMerge: true, needLight: true, teamName: '夜豹队',
  captainName: '鲍越', captainPhone: '135****6677'
})
assert(bBao.nightLock === 1, '鲍越新建预约自动打上 L1 限制快照')
payDeposit(bBao.id)
assert(bBao.lighting.deposit === 75, 'L1 预约支付押金 75 元（标准 50 ×1.5）')
assert(bBao.timeline.some(t => t.text.includes('R-NIGHT-1')), '时间线含历史违规原因与本次押金规则（R-NIGHT-1）')

// ---- 5. L2 队长预约：押金上浮 + 20:00 后时段被判禁用 ----
const bGao = createBooking({
  courtId: 'court-3', halves: ['H4'], scope: 'half', start: '20:00', end: '22:00',
  headcount: 6, acceptMerge: true, needLight: true, teamName: '夜鹰队',
  captainName: '高夜', captainPhone: '131****5566'
})
assert(bGao.nightLock === 2, '高夜新建预约自动打上 L2 限制快照')
assert(slotBlockedByNight('22:00', teamRestriction('131****5566', state.noiseRecords)),
  'L2 选择 20:00–22:00 时段会被预约表单禁用')
payDeposit(bGao.id)
assert(bGao.lighting.deposit === 75, 'L2 半场押金同样 75 元；另受 20:00 时段限制')

// ---- 6. 噪声工单首次劝导办结 → 生成/更新噪声记录四要素并升级限制 ----
resolveNoise('I-001', false)
const nr3 = noiseRecordOfIncident('I-001')!
assert(!!nr3 && nr3.outcome === 'firstWarned', 'I-001 首次劝导办结：噪声记录记为核实违规 1 次')
assert(nr3.reminders.some(x => x.verified && x.text.includes('50 元')), '现场提醒内容（含再犯收 50 元告知）写入同一记录')
assert(!!nr3.teamName && !!nr3.source && !!nr3.time, '记录含投诉时间/投诉人/使用队伍')
setNoiseLightOff(nr3.id, '20:10')
assert(nr3.lightOffAt === '20:10', '管理员可登记照明关闭时间并留痕')

const rZhouAfter = teamRestriction('137****2201', state.noiseRecords)
assert(rZhouAfter.level === 2 && rZhouAfter.violations === 3, '今晚劝导办结后散客联队累计 3 次 → 升级 L2')
const b002 = state.bookings.find(b => b.id === 'B002')!
assert(b002.nightLock === 2 && b002.lighting.deposit === 75,
  '进行中场次同步限制等级，但已付押金不追溯调整（仍为 75 元）')

// ---- 7. 投诉不成立：不计违规、不触发限制 ----
const inc = reportIncident('noise', 'court-3', [], '居民夜间来电反映', '21:42 来电称有运球声', '河滨公寓居民')
resolveNoiseUnverified(inc.id, '到场实测 54dB 未超标，场地已无人使用，回访居民')
const nrNew = noiseRecordOfIncident(inc.id)!
assert(nrNew.outcome === 'unverified' && teamRestriction(nrNew.teamKey, state.noiseRecords).level === 0,
  '未核实成立的投诉不计违规、不触发夜间限制')

// ---- 8. 社区端：限制效果（限制前后投诉核实数对比） ----
const eff = nightRestrictionEffect(state.noiseRecords)
assert(eff.rows.length === 3, '效果统计覆盖 3 支触发限制的球队')
const gaoRow = eff.rows.find(r => r.teamName === '夜鹰队')!
assert(gaoRow.restrictedAt === '2026-09-19' && gaoRow.beforeVerified === 2 &&
  gaoRow.afterVerified === 0 && gaoRow.afterUnverified === 1 && gaoRow.trend === 'down',
  '夜鹰队 L2 生效后核实违规 2→0（含 1 次未核实投诉），趋势判定为下降')
const baoRow = eff.rows.find(r => r.teamName === '夜豹队')!
assert(baoRow.beforeVerified === 1 && baoRow.afterVerified === 0,
  '夜豹队 L1 生效（9/22）前 30 天 1 次核实、生效后 0 次')

// ---- 9. 照明实时计费回归 ----
const b001 = state.bookings.find(b => b.id === 'B001')!
const q = lightQuote(b001, court1, '19:42')!
assert(Math.abs(q.minutes - 97) === 0 && Math.abs(q.fee - 62.08) < 0.01,
  'B001 19:42 时照明 97 分钟 × 0.8 元 × 拼场 8 折 = 62.08 元')
assert(Math.abs(q.perPerson - 62.08 / 6) < 0.01, '照明费按 6 名签到人均摊 ≈ 10.35 元/人')

console.log(`\n🎉 夜间限制扩展全部 ${pass} 项冒烟断言通过`)
