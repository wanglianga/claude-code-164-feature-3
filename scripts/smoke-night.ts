/* 夜间噪声限制功能冒烟断言（esbuild 打包后在 Node 运行，不依赖浏览器） */
import assert from 'node:assert'
import {
  teamViolationStats, buildRestriction, restrictionLevelFor,
  effectiveNightEnd, nightDepositFor, restrictionEffects, lightQuote,
  NIGHT_BASE_DEPOSIT_HALF, NIGHT_ELEVATED_DEPOSIT_HALF, hmLabel, complaintsByDay
} from '../src/lib/engine'
import {
  useState, previewNightBooking, createBooking, resolveNoise,
  activeNightRestrictions, nightRestrictionEffectList, payDeposit
} from '../src/store'
import type { Court, NightViolation, Booking } from '../src/types'
import { TODAY } from '../src/data/mock'

let passed = 0
function ok(name: string, cond: boolean) {
  assert.ok(cond, name)
  passed++
  console.log('  ✅', name)
}

const court3: Court = {
  id: 'ct', name: '测试河滨球场', park: 'p', halfCourts: 2,
  surface: 'good', hoops: { H1: 'normal', H2: 'normal' },
  noiseSensitive: ['测试楼'], noiseCurfew: 22, lockersTotal: 4, lockersFree: 4,
  lighting: { available: true, pricePerMinute: 1, autoOnHour: 18, deposit: 50, status: 'ok' },
  distanceM: 1, sealed: false
}

function v(date: string, time = '22:05'): NightViolation {
  return {
    id: 'nv-' + date + time, teamKey: 'team-x', complaintTime: time, bookingId: 'b',
    teamName: '测试违规队', courtId: 'ct', courtName: '测试河滨球场', source: '居民',
    noiseDb: 66, curfew: '22:00', lightsOffAt: '22:12', reminder: '立即关灯离场',
    reminderBy: 'admin', secondIn24h: true, fee: 50, date, incidentId: 'i'
  }
}

console.log('1) 限制等级随累计违规次数递进（R-NOISE-2）')
ok('0 次无限制', restrictionLevelFor(0) === 'none')
ok('1 次观察提醒', restrictionLevelFor(1) === 'watch')
ok('2 次加倍押金', restrictionLevelFor(2) === 'elevatedDeposit')
ok('3 次加倍押金+限时段', restrictionLevelFor(3) === 'timeLimited')
ok('4 次暂停夜间预约', restrictionLevelFor(4) === 'suspended')

console.log('2) 预置夜猫子队：30 天内 2 次 → 加倍押金')
const state = useState()
const owlKey = 'team-nightowl'
const owlStats = teamViolationStats(state.nightViolations, owlKey, TODAY)!
ok('聚合到 2 条历史违规', owlStats.countInWindow === 2)
const owlRestriction = buildRestriction(owlStats, court3, TODAY)!
ok('等级为加倍押金', owlRestriction.level === 'elevatedDeposit')
ok('半场押金上浮到 100', owlRestriction.depositHalf === NIGHT_ELEVATED_DEPOSIT_HALF)
ok('给出历史违规原因', owlRestriction.reasons.length >= 2)

console.log('3) 预约前预览：夜猫子队夜间半场押金 100、普通队 50')
const owlPreview = previewNightBooking({ teamName: '夜猫子篮球队', courtId: 'court-3', scope: 'half', start: '20:00', end: '22:00' })
ok('夜猫子半场押金 100', owlPreview.deposit === 100)
ok('夜猫子未被暂停', owlPreview.blocked === false)
const normalPreview = previewNightBooking({ teamName: '普通新球队', courtId: 'court-3', scope: 'half', start: '20:00', end: '22:00' })
ok('普通队半场押金 50', normalPreview.deposit === NIGHT_BASE_DEPOSIT_HALF)
ok('普通队无限制', normalPreview.restriction === null)
const owlFull = previewNightBooking({ teamName: '夜猫子篮球队', courtId: 'court-3', scope: 'full', start: '20:00', end: '22:00' })
ok('夜猫子全场押金 200', owlFull.deposit === 200)

console.log('4) 平台结束时间取最早值（R-NOISE-3）')
const probe = { end: '22:30' } as Booking
ok('无限制时截止到静音 22:00', effectiveNightEnd(probe, court3, null) === '22:00')
ok('限时段 21:00 时取 21:00', effectiveNightEnd(probe, court3, {
  ...owlRestriction, level: 'timeLimited', latestEnd: '21:00', depositHalf: 100
}) === '21:00')
const court21: Court = { ...court3, noiseCurfew: 21 }
ok('21 点静音场地无限制也取 21:00', effectiveNightEnd({ end: '22:00' } as Booking, court21, null) === '21:00')

console.log('5) 照明计费在静音截止时间自动停止（R-NOISE-3）')
const b902 = state.bookings.find(b => b.id === 'B003')! // 19:00–21:00 河滨，灯 19:02 开
const qEarly = lightQuote(b902, state.courts.find(c => c.id === 'court-3')!, '19:42')!
ok('19:42 时照明已计 40 分钟', qEarly.minutes === 40)
const lateB: Booking = {
      ...b902, id: 'B-LATE', lighting: { enabled: true, onAt: '18:00', minutes: 0, fee: 0, deposit: 100 },
      status: 'ongoing', actualStart: '18:00', end: '22:30', acceptMerge: false, scope: 'half',
      members: [{ id: 'm', name: 'x', phone: '', isCaptain: true, checkedIn: true }]
    } as Booking
const qLate = lightQuote(lateB, court3, '22:30')!
ok('22:30 时照明只计到 22:00（240 分钟，非 270）', qLate.minutes === 240)

console.log('6) 噪声工单处置：四要素留痕 + 关灯停止计费（R-NOISE-1/2/3）')
const beforeCount = state.nightViolations.length
const b002 = state.bookings.find(b => b.id === 'B002')!
resolveNoise('I-001', { secondVerified: false, complaintTime: '19:38', lightsOffAt: '20:00', reminder: '请降低音量并于 21:00 前结束', noiseDb: 62 })
ok('新增一条夜间违规留痕', state.nightViolations.length === beforeCount + 1)
const nv = state.nightViolations[0]
ok('记录投诉时间', nv.complaintTime === '19:38')
ok('记录使用队伍', nv.teamName === b002.teamName)
ok('记录照明关闭时间', nv.lightsOffAt === '20:00')
ok('记录现场提醒', nv.reminder.includes('降低音量'))
ok('首次劝导不收费', nv.fee === 0 && nv.secondIn24h === false)

console.log('7) 限制生效前后投诉对比（社区端）')
const effects = nightRestrictionEffectList()
const owlEffect = effects.find(e => e.teamName === '夜猫子篮球队')
ok('能取到夜猫子队限制效果', !!owlEffect)
ok('生效后暂无新增投诉（触发当天不计入）', owlEffect!.after === 0)
ok('按日趋势可统计', complaintsByDay(state.nightViolations).length >= 2)

console.log('8) 创建夜间预约写入限制快照与押金（端到端）')
const created = createBooking({
  courtId: 'court-3', halves: ['H4'], scope: 'half',
  start: '20:00', end: '22:00', headcount: 5, acceptMerge: true, needLight: true,
  teamName: '夜猫子篮球队', captainName: '涂鹰', captainPhone: '135****0000'
})
ok('新预约携带夜间限制快照', created.nightRestriction?.level === 'elevatedDeposit')
payDeposit(created.id)
ok('受限队实缴押金 100', created.lighting.deposit === 100)
ok('时间线含押金上浮与结束时间公示', created.timeline.some(t => t.text.includes('R-NOISE-2')) && created.timeline.some(t => t.text.includes('R-NOISE-3')))

console.log('9) 第 4 次违规暂停夜间预约，预览拦截')
const four = [v('2026-09-25'), v('2026-09-20'), v('2026-09-15'), v('2026-09-10')]
const stats4 = teamViolationStats(four, 'team-x', TODAY)!
const r4 = buildRestriction(stats4, court3, TODAY)!
ok('4 次 → 暂停', r4.level === 'suspended')
ok('暂停等级押金取值仍为上浮额', nightDepositFor(r4) === NIGHT_ELEVATED_DEPOSIT_HALF)

console.log(`\n全部 ${passed} 项夜间限制断言通过 ✅`)
void hmLabel
void activeNightRestrictions
