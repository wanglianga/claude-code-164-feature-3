import { computed, reactive, ref } from 'vue'
import type {
  Booking, Court, FeeItem, Incident, IncidentAction, IncidentStatus,
  IncidentType, Member, MergeRequest, NightRestriction, NightViolation, RoleId, Scope, TimelineEvent
} from './types'
import { BOOKINGS, COURTS, INCIDENTS, MERGE_REQUESTS, NIGHT_VIOLATIONS, NOW_HM, ROLES, TODAY } from './data/mock'
import {
  buildRestriction, checkedInCount, effectiveNightEnd, feeSummary, hm, lightQuote,
  nightDepositFor, complaintsByDay, restrictionEffects, teamKeyOf, teamViolationStats,
  RESTRICTION_META
} from './lib/engine'

// ---------- 模拟时钟 ----------
const nowStr = ref(NOW_HM)
export const nowMin = computed(() => hm(nowStr.value))
let timer: ReturnType<typeof setInterval> | null = null
const autoRun = ref(false)

export function tick(min = 1) {
  let v = nowMin.value + min
  if (v >= 24 * 60) v = 23 * 60 + 59
  const h = Math.floor(v / 60)
  const m = v % 60
  nowStr.value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
export function resetClock() {
  nowStr.value = NOW_HM
}
export function toggleAuto() {
  autoRun.value = !autoRun.value
  if (autoRun.value) {
    timer = setInterval(() => tick(1), 10_000) // 演示：每 10 秒推进 1 分钟
  } else if (timer) {
    clearInterval(timer)
    timer = null
  }
}
export { nowStr, autoRun }

// ---------- 全局状态 ----------
interface State {
  role: RoleId
  courts: Court[]
  bookings: Booking[]
  incidents: Incident[]
  mergeRequests: MergeRequest[]
  /** 夜间噪声违规留痕（四要素，跨日历史，用于累计限制与效果回看） */
  nightViolations: NightViolation[]
  /** 站内消息（模拟短信/通知） */
  notices: { id: number; to: RoleId | 'all'; text: string; at: string }[]
}

const state = reactive<State>({
  role: 'captain',
  courts: structuredClone(COURTS),
  bookings: structuredClone(BOOKINGS),
  incidents: structuredClone(INCIDENTS),
  mergeRequests: structuredClone(MERGE_REQUESTS),
  nightViolations: structuredClone(NIGHT_VIOLATIONS),
  notices: []
})

let noticeSeq = 1
export function notify(to: RoleId | 'all', text: string) {
  state.notices.unshift({ id: noticeSeq++, to, text, at: nowStr.value })
}

export function useState() {
  return state
}
export const roles = ROLES
export function setRole(r: RoleId) {
  state.role = r
}

const idCounters: Record<string, number> = { B: 12, 'MR-': 3, I: 6, NV: 2 }
function nextId(prefix: string, pad = 3) {
  const n = (idCounters[prefix] = (idCounters[prefix] ?? 0) + 1)
  return `${prefix}${String(n).padStart(pad, '0')}`
}
const seq = { member: 100 }

function tl(b: Booking, text: string, tone: TimelineEvent['tone'] = 'default') {
  b.timeline.push({ at: nowStr.value, text, tone })
}

// ---------- 预约 ----------
export interface BookingForm {
  courtId: string
  halves: string[]
  scope: Scope
  start: string
  end: string
  headcount: number
  acceptMerge: boolean
  needLight: boolean
  teamName: string
  captainName: string
  captainPhone: string
}

/** 由队伍名称解析稳定球队标识：优先命中历史违规/已有预约上的 teamKey */
function resolveTeamKey(teamName: string): string {
  const t = teamName.trim()
  const byViolation = state.nightViolations.find(v => v.teamKey === t || v.teamName === t)
  if (byViolation) return byViolation.teamKey
  const byBooking = state.bookings.find(b => b.teamName === t && b.teamKey)
  return byBooking?.teamKey ?? t
}

/** 某球队当前生效的夜间限制（30 天窗口实时计算） */
export function nightRestrictionForTeam(teamNameOrKey: string, courtId: string): NightRestriction | null {
  const court = state.courts.find(c => c.id === courtId)
  const key = state.nightViolations.some(v => v.teamKey === teamNameOrKey)
    ? teamNameOrKey
    : resolveTeamKey(teamNameOrKey)
  const stats = teamViolationStats(state.nightViolations, key, TODAY)
  return buildRestriction(stats, court, TODAY)
}

/** 某预约所属球队当前生效的夜间限制（优先用预约时快照，其次实时计算） */
export function nightRestrictionForBooking(b: Booking): NightRestriction | null {
  const court = state.courts.find(c => c.id === b.courtId)
  const stats = teamViolationStats(state.nightViolations, teamKeyOf(b), TODAY)
  return buildRestriction(stats, court, TODAY)
}

export interface NightPreview {
  restriction: NightRestriction | null
  /** 半场押金（元） */
  depositHalf: number
  /** 本场实际应缴押金（全场 ×2） */
  deposit: number
  /** 平台公示结束时间（预约结束 / 静音截止 / 限时段取最早，R-NOISE-3） */
  effectiveEnd: string
  curfew: string
  /** 被暂停夜间预约 */
  blocked: boolean
  /** 预约结束是否被限制规则提前截断 */
  capped: boolean
}

/** 预约前的夜间规则预览：历史违规原因、本次押金、结束时间 */
export function previewNightBooking(input: {
  teamName: string; courtId: string; scope: Scope; start: string; end: string
}): NightPreview {
  const court = state.courts.find(c => c.id === input.courtId)!
  const restriction = nightRestrictionForTeam(input.teamName, input.courtId)
  const depositHalf = nightDepositFor(restriction)
  const isNight = hm(input.start) >= court.lighting.autoOnHour * 60
  const blocked = !!restriction && restriction.level === 'suspended' && isNight
  const probe: Booking = { ...({} as Booking), end: input.end }
  const effectiveEnd = isNight ? effectiveNightEnd(probe, court, restriction) : input.end
  return {
    restriction,
    depositHalf,
    deposit: input.scope === 'full' ? depositHalf * 2 : depositHalf,
    effectiveEnd,
    curfew: `${String(court.noiseCurfew).padStart(2, '0')}:00`,
    blocked,
    capped: effectiveEnd !== input.end
  }
}

export function createBooking(form: BookingForm): Booking {
  const id = nextId('B')
  const member: Member = {
    id: `m-new-${seq.member}`,
    name: form.captainName || '我',
    phone: form.captainPhone || '未填写',
    isCaptain: true,
    checkedIn: false
  }
  const teamKey = resolveTeamKey(form.teamName || form.captainName || '我的队伍')
  const court = state.courts.find(c => c.id === form.courtId)!
  const preview = previewNightBooking({
    teamName: form.teamName || form.captainName || '我的队伍',
    courtId: form.courtId, scope: form.scope, start: form.start, end: form.end
  })
  // 限时段：结束时间不得晚于允许值；暂停夜间预约：拒绝创建
  const finalEnd = preview.capped ? preview.effectiveEnd : form.end
  const b: Booking = {
    id,
    code: String(100000 + Math.floor(Math.random() * 899999)),
    courtId: form.courtId,
    halves: form.halves,
    scope: form.scope,
    date: TODAY,
    start: form.start,
    end: finalEnd,
    headcount: form.headcount,
    acceptMerge: form.acceptMerge,
    teamName: form.teamName || '我的队伍',
    teamKey,
    captainId: 'u-me',
    captainName: form.captainName || '我',
    captainPhone: form.captainPhone || '未填写',
    members: [member],
    status: 'booked',
    payStatus: 'unpaid',
    checkInCode: '',
    lighting: { enabled: false, minutes: 0, fee: 0, deposit: 0 },
    fees: [],
    credit: 100,
    timeline: []
  }
  if (preview.restriction && preview.restriction.level !== 'none' && preview.restriction.level !== 'watch') {
    b.nightRestriction = {
      level: preview.restriction.level,
      depositHalf: preview.restriction.depositHalf,
      latestEnd: preview.restriction.latestEnd,
      reasons: preview.restriction.reasons,
      depositRule: preview.restriction.depositRule
    }
  }
  b.checkInCode = b.code
  tl(b, `预约成功：${form.scope === 'full' ? '全场' : '半场'} ${form.halves.join('/')} ${form.start}–${finalEnd}，${form.headcount} 人${form.acceptMerge ? '，接受拼场（照明 8 折）' : '，不接受拼场'}`, 'success')
  if (preview.capped) {
    tl(b, `你所在球队处于夜间限时段，预约结束时间已按平台规则调整为 ${finalEnd}（不得更晚），该结束时间对全队公示（R-NOISE-2 / R-NOISE-3）`, 'warning')
  }
  if (form.headcount < (form.scope === 'full' ? 8 : 4)) {
    tl(b, '人数低于建议下限，系统建议开放拼场以提高公共场地利用率（R-BOOK-1）', 'warning')
  }
  if (form.needLight) {
    tl(b, `已预约夜间照明，开灯前需支付照明押金（半场 ${preview.depositHalf} 元 / 全场 ${preview.depositHalf * 2} 元${preview.depositHalf > 50 ? '，违规队上浮标准' : ''}，R-LIGHT-2 / R-NOISE-2）`, 'info')
  }
  if (hm(form.start) >= court.lighting.autoOnHour * 60) {
    tl(b, `夜间场次：平台结束时间 ${finalEnd}，场地静音截止 ${preview.curfew}，到点照明自动关闭；队长不得以个人承诺延长，队员均可查看结束时间（R-NOISE-3）`, 'info')
  }
  if (preview.restriction && (preview.restriction.level === 'elevatedDeposit' || preview.restriction.level === 'timeLimited' || preview.restriction.level === 'suspended')) {
    tl(b, `预约前已向队长公示历史噪声违规与押金规则：${preview.restriction.depositRule}`, 'warning')
  }
  state.bookings.push(b)
  notify(state.role, `预约成功，签到码 ${b.code}，请在开场后 15 分钟内签到；夜间结束时间 ${finalEnd}`)
  return b
}

// ---------- 签到 / 队员 ----------
export function addMember(bookingId: string, name: string, phone: string, minor = false) {
  const b = state.bookings.find(x => x.id === bookingId)
  if (!b || !name.trim()) return
  b.members.push({
    id: `m-inv-${++seq.member}`,
    name: name.trim(),
    phone: phone.trim() || '未填写',
    isCaptain: false,
    checkedIn: false,
    minor
  })
  b.headcount = b.members.length
  tl(b, `队长向 ${name} 发送签到邀请（签到码 ${b.checkInCode}）`, 'info')
}

export function toggleCheckIn(bookingId: string, memberId: string) {
  const b = state.bookings.find(x => x.id === bookingId)!
  const m = b.members.find(x => x.id === memberId)!
  m.checkedIn = !m.checkedIn
  m.checkInAt = m.checkedIn ? nowStr.value : undefined
  if (m.checkedIn) {
    if (b.status === 'booked') {
      b.status = hm(nowStr.value) > hm(b.start) + 15 ? 'late' : 'ongoing'
      b.actualStart = b.actualStart ?? nowStr.value
    }
    tl(b, `${m.name} 到场签到（${checkedInCount(b)}/${b.members.length}）`, 'success')
  }
}

/** 散客凭签到码自助签到 */
export function checkInByCode(code: string, name: string): boolean {
  const b = state.bookings.find(x => x.checkInCode === code)
  if (!b) return false
  const m = b.members.find(x => x.name.includes(name) || name.includes(x.name)) ??
    (name ? { id: `m-inv-${++seq.member}`, name, phone: '现场签到', isCaptain: false, checkedIn: false } as Member : undefined)
  if (m && !b.members.includes(m)) b.members.push(m)
  if (!m) return false
  m.checkedIn = true
  m.checkInAt = nowStr.value
  if (b.status === 'booked') {
    b.status = hm(nowStr.value) > hm(b.start) + 15 ? 'late' : 'ongoing'
    b.actualStart = b.actualStart ?? nowStr.value
  }
  tl(b, `${m.name} 凭签到码到场签到（${checkedInCount(b)}/${b.members.length}）`, 'success')
  return true
}

// ---------- 拼场 ----------
export function applyMerge(bookingId: string, walkerName: string, walkerPhone: string, people: number, message: string, minor = false) {
  const b = state.bookings.find(x => x.id === bookingId)!
  const req: MergeRequest = {
    id: nextId('MR-'),
    bookingId,
    walkerName,
    walkerPhone,
    people,
    minor,
    message,
    status: 'pending',
    time: nowStr.value
  }
  state.mergeRequests.unshift(req)
  tl(b, `散客 ${walkerName} 等 ${people} 人申请拼场，队长须在 10 分钟内处理（R-BOOK-2）`, 'warning')
  notify('captain', `新拼场申请：${walkerName} 等 ${people} 人想加入 ${b.teamName}`)
}

export function respondMerge(reqId: string, accept: boolean, reason = '') {
  const req = state.mergeRequests.find(x => x.id === reqId)!
  const b = state.bookings.find(x => x.id === req.bookingId)!
  req.status = accept ? 'accepted' : 'rejected'
  if (accept) {
    for (let i = 0; i < req.people; i++) {
      b.members.push({
        id: `m-merge-${++seq.member}`,
        name: i === 0 ? req.walkerName : `${req.walkerName}同伴${i + 1}`,
        phone: req.walkerPhone,
        isCaptain: false,
        checkedIn: false,
        minor: req.minor
      })
    }
    b.headcount = b.members.length
    tl(b, `队长同意 ${req.walkerName} 等 ${req.people} 人拼场，照明费将按签到人数平摊（8 折，R-BOOK-2）`, 'success')
    notify('walkin', `拼场申请已通过：${b.teamName}，到场向队长出示即可签到`)
  } else {
    // 简化判定：填了正当理由则不罚
    const unreasonable = !reason.trim()
    req.unreasonable = unreasonable
    if (unreasonable) {
      if (!b.fees.some(f => f.kind === 'refuseMerge')) {
        b.fees.push({ kind: 'refuseMerge', label: '无正当理由拒绝拼场 · 资源占用费', amount: 20, ruleId: 'R-MERGE-1', note: `${req.walkerName} 等 ${req.people} 人申请被拒，队长未填写理由` })
      }
      b.credit = Math.max(0, b.credit - 5)
      tl(b, `拒绝 ${req.walkerName} 拼场且无正当理由：收资源占用费 20 元，信用 -5（R-MERGE-1）`, 'error')
      notify('walkin', `很遗憾，${b.teamName} 拒绝了拼场申请，可查看其他可拼队伍`)
    } else {
      tl(b, `拒绝拼场，理由：${reason}（系统登记为正当理由，不收费）`, 'default')
      notify('walkin', `${b.teamName} 未能接受拼场：${reason}`)
    }
  }
}

// ---------- 照明与结算 ----------
export function payDeposit(bookingId: string) {
  const b = state.bookings.find(x => x.id === bookingId)!
  const court = state.courts.find(c => c.id === b.courtId)!
  const half = b.nightRestriction && b.nightRestriction.level !== 'watch'
    ? b.nightRestriction.depositHalf
    : court.lighting.deposit
  b.lighting.deposit = b.scope === 'full' ? half * 2 : half
  b.payStatus = 'depositPaid'
  tl(b, `照明押金 ${b.lighting.deposit} 元已支付${half > court.lighting.deposit ? '（夜间违规队上浮押金，R-NOISE-2）' : ''}`, 'success')
}

export function turnOnLight(bookingId: string) {
  const b = state.bookings.find(x => x.id === bookingId)!
  const court = state.courts.find(c => c.id === b.courtId)!
  if (b.lighting.deposit <= 0) payDeposit(bookingId)
  b.lighting.enabled = true
  b.lighting.onAt = nowStr.value
  if (!b.fees.some(f => f.kind === 'lighting')) {
    b.fees.push({ kind: 'lighting', label: '照明费（实时累计）', amount: 0, ruleId: 'R-LIGHT-1' })
  }
  if (b.status === 'booked') {
    b.status = 'ongoing'
    b.actualStart = b.actualStart ?? nowStr.value
  }
  tl(b, `照明开启（${b.scope === 'full' ? '全场按 2 个半场' : '半场'} ${court.lighting.pricePerMinute} 元/分钟${b.acceptMerge ? '，拼场 8 折' : ''}），开始计费`, 'info')
}

export interface SettleResult {
  charges: number
  refunds: number
  deposit: number
  balance: number
  needTopup: number
}

export function endUsage(bookingId: string, forced = false): SettleResult {
  const b = state.bookings.find(x => x.id === bookingId)!
  const court = state.courts.find(c => c.id === b.courtId)
  if (b.lighting.enabled && !b.lighting.offAt) b.lighting.offAt = nowStr.value
  const summary = feeSummary(b, court, nowStr.value)
  // 重写费用表：静态条目（去掉旧 lighting 占位）+ 实时照明 + 迟到/超时
  const statics = b.fees.filter(f => f.kind !== 'lighting')
  const items: FeeItem[] = [...statics]
  if (summary.light) {
    const q = summary.light
    items.unshift({
      kind: 'lighting',
      label: `照明费 ${q.minutes} 分钟${b.scope === 'full' ? '（全场）' : ''}${q.rate < 1 ? ' × 拼场 8 折' : ''}，签到 ${checkedInCount(b)} 人平摊`,
      amount: Math.round(q.fee * 100) / 100,
      ruleId: 'R-LIGHT-1'
    })
    b.lighting.minutes = q.minutes
    b.lighting.fee = Math.round(q.fee * 100) / 100
  }
  for (const dyn of summary.items) {
    if (!statics.some(s => s.kind === dyn.kind)) items.push(dyn)
  }
  b.fees = items
  const early = hm(nowStr.value) < hm(b.end)
  const balance = Math.round((summary.deposit - summary.charges) * 100) / 100
  if (balance >= 0) {
    if (balance > 0) items.push({ kind: 'earlyRefund', label: `押金余额退回（1–3 个工作日原路退回）`, amount: -balance, ruleId: 'R-OT-1' })
    b.payStatus = balance > 0 ? 'refunded' : 'paid'
  } else {
    b.payStatus = 'deducted'
  }
  b.actualEnd = nowStr.value
  b.status = early ? 'earlyLeave' : 'finished'
  tl(b, forced
    ? `管理员强制结束使用并关灯：费用合计 ${summary.charges.toFixed(2)} 元，押金 ${summary.deposit} 元${balance < 0 ? `，需补缴 ${(-balance).toFixed(2)} 元` : `，退回 ${balance.toFixed(2)} 元`}`
    : `结束使用并关灯：实际使用至 ${nowStr.value}，照明 ${summary.light?.minutes ?? 0} 分钟，费用合计 ${summary.charges.toFixed(2)} 元${balance < 0 ? `，需补缴 ${(-balance).toFixed(2)} 元` : `，押金退回 ${balance.toFixed(2)} 元`}`,
    balance < 0 ? 'error' : 'success')
  return { charges: summary.charges, refunds: summary.refunds, deposit: summary.deposit, balance, needTopup: balance < 0 ? -balance : 0 }
}

export function topUp(bookingId: string) {
  const b = state.bookings.find(x => x.id === bookingId)!
  b.payStatus = 'paid'
  tl(b, '离场前补缴完成，费用已结清', 'success')
}

/** 爽约释放（R-LATE-1 / R-FAIR-2） */
export function releaseBooking(bookingId: string) {
  const b = state.bookings.find(x => x.id === bookingId)!
  b.status = 'noshow'
  b.credit = Math.max(0, b.credit - 10)
  if (b.lighting.deposit > 0) {
    b.fees.push({ kind: 'late', label: '超 20 分钟未签到 · 押金不退（爽约）', amount: b.lighting.deposit, ruleId: 'R-LATE-1' })
    b.payStatus = 'deducted'
  }
  tl(b, '管理员释放该半场给现场候补队伍：原预约记爽约，押金不退、信用 -10（R-LATE-1 / R-FAIR-2）', 'error')
  notify('admin', `${b.teamName} 场地已释放，可分配给候补散客`)
}

// ---------- 事件 / 调解 ----------
function act(incident: Incident, by: RoleId, text: string) {
  const a: IncidentAction = { at: nowStr.value, by, text }
  incident.actions.push(a)
  for (const bid of incident.bookingIds) {
    const b = state.bookings.find(x => x.id === bid)
    b?.timeline.push({ at: nowStr.value, text: `【${incident.title}】${text}`, tone: 'warning' })
  }
}

export function setIncidentStatus(id: string, status: IncidentStatus) {
  const inc = state.incidents.find(x => x.id === id)!
  inc.status = status
}

export function addIncidentAction(id: string, by: RoleId, text: string) {
  act(state.incidents.find(x => x.id === id)!, by, text)
}

/** 照明故障核验（R-LIGHT-3） */
export function resolveLightFault(id: string, choice: 'wait' | 'reschedule' | 'refund') {
  const inc = state.incidents.find(x => x.id === id)!
  const b = state.bookings.find(x => x.id === inc.bookingIds[0])!
  if (choice === 'wait') {
    inc.status = 'mediating'
    act(inc, 'admin', '现场核验照明故障属实：费用计时已冻结，已通知维修班（到场预计 20 分钟）。超 30 分钟未修复将赠同时长免费券并可再次选择改约/退款（R-LIGHT-3）')
  } else if (choice === 'reschedule') {
    b.status = 'rescheduled'
    b.payStatus = 'refunded'
    b.adminNote = '照明故障改约：明日（9/28）同时段河滨公园灯光球场 H3，享优先排位；押金 50 元全额退回，已冻结照明费免收（R-LIGHT-3）。'
    b.fees = b.fees.filter(f => f.kind !== 'lighting')
    b.fees.push({ kind: 'weather', label: '照明故障 · 押金全额退回 + 优先改约', amount: -b.lighting.deposit, ruleId: 'R-LIGHT-3' })
    b.lighting.fee = 0
    inc.status = 'resolved'
    inc.ruleApplied = ['R-LIGHT-3']
    inc.penalty = '无（场地方责任）'
    act(inc, 'admin', '核验属实：队伍选择改约河滨公园 H3（优先排位），照明费免收、押金 50 元全额退回')
    notify('captain', '照明故障处理完成：已为你改约，押金全额退回')
  } else {
    b.status = 'cancelled'
    b.payStatus = 'refunded'
    b.fees = b.fees.filter(f => f.kind !== 'lighting')
    b.fees.push({ kind: 'weather', label: '照明故障 · 全额退款', amount: -b.lighting.deposit, ruleId: 'R-LIGHT-3' })
    b.lighting.fee = 0
    inc.status = 'resolved'
    inc.ruleApplied = ['R-LIGHT-3']
    inc.penalty = '无（场地方责任）'
    act(inc, 'admin', '核验属实：队伍选择全额退款，照明费免收、押金 50 元原路退回，工单关闭')
  }
}

/** 噪声投诉处置入参（四要素 + 是否 24h 内第 2 次核实） */
export interface NoiseResolveInput {
  secondVerified: boolean
  /** 投诉/登记时间 HH:mm（默认工单时间） */
  complaintTime?: string
  /** 照明关闭时间 HH:mm（现场关灯留痕） */
  lightsOffAt: string
  /** 管理员/社区工作人员现场提醒内容 */
  reminder: string
  /** 实测分贝（选填） */
  noiseDb?: number
}

/** 噪声投诉处置（R-NOISE-1 / R-NOISE-2 / R-NOISE-3） */
export function resolveNoise(id: string, input: NoiseResolveInput) {
  const inc = state.incidents.find(x => x.id === id)!
  const b = inc.bookingIds.map(bid => state.bookings.find(x => x.id === bid)).find(Boolean)
  const court = state.courts.find(c => c.id === inc.courtId)!
  const complaintTime = input.complaintTime || inc.time
  inc.nightRecord = {
    complaintTime,
    lightsOffAt: input.lightsOffAt,
    reminder: input.reminder,
    reminderBy: state.role === 'admin' ? 'admin' : 'worker',
    noiseDb: input.noiseDb
  }
  const reminderBy: RoleId = inc.nightRecord.reminderBy

  // 二次核实处罚立即强制关灯（按当前时间）；首次劝导若登记关灯时间已到则按该时间关灯（R-NOISE-3）。
  // 首次劝导登记的是未来时间时不提前冻结照明费，计费到静音截止自动停止。
  const forcedNow = input.secondVerified && hm(input.lightsOffAt) > hm(nowStr.value)
  const effectiveOffAt = forcedNow ? nowStr.value : input.lightsOffAt
  const forceOff = input.secondVerified || hm(input.lightsOffAt) <= hm(nowStr.value)
  if (b && b.lighting.enabled && !b.lighting.offAt && forceOff) {
    b.lighting.offAt = effectiveOffAt
    tl(b, `应噪声现场处置，照明于 ${effectiveOffAt} 关闭、计费停止（R-NOISE-3）`, 'warning')
  }

  if (b) {
    // 四要素合并为一条违规留痕
    const nv: NightViolation = {
      id: nextId('NV-'),
      teamKey: teamKeyOf(b),
      complaintTime,
      bookingId: b.id,
      teamName: b.teamName,
      courtId: inc.courtId,
      courtName: court.name,
      source: inc.source,
      noiseDb: input.noiseDb,
      curfew: `${String(court.noiseCurfew).padStart(2, '0')}:00`,
      lightsOffAt: input.lightsOffAt,
      reminder: input.reminder,
      reminderBy,
      secondIn24h: input.secondVerified,
      fee: input.secondVerified ? 50 : 0,
      date: TODAY,
      incidentId: inc.id
    }
    state.nightViolations.unshift(nv)
  }

  if (!input.secondVerified) {
    inc.status = 'resolved'
    inc.penalty = '首次劝导，不予处罚；已登记投诉时间/队伍/关灯时间/现场提醒四要素（R-NOISE-2）'
    act(inc, reminderBy, `现场劝导完成（投诉时间 ${complaintTime}，队伍 ${b?.teamName ?? '—'}，照明 ${input.lightsOffAt} 关闭）：${input.reminder}；投诉时间、使用队伍、照明关闭时间、现场提醒已一并记录留痕（R-NOISE-1 / R-NOISE-2）`)
  } else {
    inc.status = 'penalized'
    if (b) {
      b.fees.push({ kind: 'complaint', label: '24 小时内第 2 次噪声投诉核实 · 社区安宁费', amount: 50, ruleId: 'R-NOISE-1', note: '第 3 次将限制夜间时段并上浮押金（R-NOISE-2）' })
      b.credit = Math.max(0, b.credit - 5)
    }
    inc.penalty = '收取社区安宁费 50 元、信用 -5；累计违规将触发加倍押金/限时段（R-NOISE-2）'
    act(inc, reminderBy, `第 2 次现场核实噪声超标${input.noiseDb ? `（实测 ${input.noiseDb}dB）` : ''}：投诉时间 ${complaintTime}、队伍 ${b?.teamName ?? '—'}、照明 ${input.lightsOffAt} 关闭；现场提醒"${input.reminder}"。收取社区安宁费 50 元，书面答复投诉居民并留痕（R-NOISE-1 / R-FAIR-3 / R-NOISE-2）`)
    if (b) notify('captain', '噪声投诉已二次核实：收取 50 元社区安宁费，请注意控制音量')
  }

  // 累计违规 → 更新该队后续夜间预约限制
  if (b) {
    const restriction = nightRestrictionForBooking(b)
    if (restriction && restriction.level !== 'none' && restriction.level !== 'watch') {
      b.nightRestriction = {
        level: restriction.level,
        depositHalf: restriction.depositHalf,
        latestEnd: restriction.latestEnd,
        reasons: restriction.reasons,
        depositRule: restriction.depositRule
      }
      if (restriction.level === 'timeLimited') {
        tl(b, `累计 ${restriction.violationCount} 次夜间噪声违规：后续夜间预约结束不得晚于 ${restriction.latestEnd}、押金上浮至半场 ${restriction.depositHalf} 元（R-NOISE-2）`, 'error')
        notify('captain', `你的球队已被夜间限时段（结束≤${restriction.latestEnd}）并上浮押金`)
      } else if (restriction.level === 'suspended') {
        tl(b, `累计 ${restriction.violationCount} 次违规：暂停夜间预约资格 30 天（R-NOISE-2）`, 'error')
      } else {
        tl(b, `累计 ${restriction.violationCount} 次夜间噪声违规：后续夜间预约押金上浮至半场 ${restriction.depositHalf} 元（R-NOISE-2）`, 'error')
      }
    } else if (restriction?.level === 'watch') {
      tl(b, '已登记 1 次夜间噪声违规（观察期）：再次违规将上浮夜间押金（R-NOISE-2）', 'warning')
    }
  }
}

/** 未成年人处置（R-MINOR-1） */
export function resolveMinor(id: string) {
  const inc = state.incidents.find(x => x.id === id)!
  inc.status = 'resolved'
  inc.penalty = '不计收费；同队伍当月累计 3 次扣信用 5 分'
  act(inc, 'worker', '监护人已到场接回郑凯，登记离场时间；本次不计收费（R-MINOR-1）')
}

/** 封场（R-SEAL-1）。有关联预约时按预约所占半场局部封停，否则全场地封停 */
export function issueSealOrder(id: string, reason: string, recoverAt: string) {
  const inc = state.incidents.find(x => x.id === id)!
  const court = state.courts.find(c => c.id === inc.courtId)!
  const linkedHalves = [...new Set(
    inc.bookingIds.flatMap(bid => state.bookings.find(x => x.id === bid)?.halves ?? [])
  )]
  const fullSeal = linkedHalves.length === 0
  if (fullSeal) {
    court.sealed = true
    court.sealReason = `${reason}（预计 ${recoverAt} 恢复）`
  } else {
    court.sealedHalves = [...new Set([...(court.sealedHalves ?? []), ...linkedHalves])]
    court.sealReason = `${linkedHalves.join('/')} 封停：${reason}（预计 ${recoverAt} 恢复）`
  }
  inc.status = 'resolved'
  inc.ruleApplied = ['R-SEAL-1']
  act(inc, 'admin', `签发封场令：${reason}，范围 ${court.name}${fullSeal ? '全场' : linkedHalves.join('/')}，预计 ${recoverAt} 恢复；原因/范围/恢复时间已公示（R-SEAL-1）`)
  const targets = fullSeal
    ? state.bookings.filter(x => x.courtId === court.id && ['booked', 'ongoing', 'late', 'overtime'].includes(x.status))
    : state.bookings.filter(x => x.courtId === court.id &&
        ['booked', 'ongoing', 'late', 'overtime'].includes(x.status) &&
        x.halves.some(h => linkedHalves.includes(h)))
  for (const b of targets) {
    if (b.lighting.enabled) {
      b.lighting.offAt = nowStr.value
      b.fees = b.fees.filter(f => f.kind !== 'lighting')
    }
    b.status = 'sealed'
    b.payStatus = 'refunded'
    const refund = b.lighting.deposit
    if (refund > 0) b.fees.push({ kind: 'sealRefund', label: '封场 · 照明不计费，押金全额退回', amount: -refund, ruleId: 'R-SEAL-1' })
    b.adminNote = `因「${reason}」封场（${fullSeal ? '全场地' : linkedHalves.join('/')}）：本场中止/取消，押金费用全额退回，可免费改约并享优先排位（R-SEAL-1）。`
    tl(b, `管理员封场（${reason}）：照明不计费、押金全额退回，可免费改约优先排位（R-SEAL-1）`, 'error')
  }
  notify('all', `${court.name}${fullSeal ? '' : ' ' + linkedHalves.join('/')} 已封场：${reason}，预计 ${recoverAt} 恢复`)
}

/** 篮筐争议裁决（R-DISPUTE-1） */
export function ruleDispute(id: string, ruling: string) {
  const inc = state.incidents.find(x => x.id === id)!
  inc.status = 'resolved'
  inc.ruleApplied = ['R-DISPUTE-1']
  act(inc, 'admin', `裁决：${ruling}。依据预约码、签到记录与时段比对结果执行（R-DISPUTE-1），结论已同步双方并留痕`)
}

/** 通用新事件上报 */
export function reportIncident(type: IncidentType, courtId: string, bookingIds: string[], title: string, desc: string, source: string) {
  const inc: Incident = {
    id: nextId('I-'),
    type, courtId, bookingIds, title, desc, source,
    time: nowStr.value,
    status: 'open',
    actions: [{ at: nowStr.value, by: state.role === 'walkin' || state.role === 'captain' ? state.role : 'worker', text: `${source} 上报：${desc}` }]
  }
  state.incidents.unshift(inc)
  for (const bid of bookingIds) {
    const b = state.bookings.find(x => x.id === bid)
    b && tl(b, `新事件：${title}，等待管理员/社区工作人员核验`, 'warning')
  }
  notify('admin', `新事件上报：${title}`)
  return inc
}

/** 天气：发布暂停/恢复使用（R-WX-1） */
export function setSurface(courtId: string, surface: Court['surface'], note: string) {
  const c = state.courts.find(x => x.id === courtId)!
  c.surface = surface
  notify('all', `${c.name}：${note}`)
}

/** 管理员改约（R-FAIR-4） */
export function adminReschedule(bookingId: string, newStart: string, newEnd: string, reason: string, compensate: number) {
  const b = state.bookings.find(x => x.id === bookingId)!
  b.status = 'rescheduled'
  b.adminNote = `管理员改约至 ${newStart}–${newEnd}。理由：${reason}（依据 R-FAIR-4 优先级排序），补偿 ${compensate} 元，新时段优先排位。`
  if (compensate > 0) b.fees.push({ kind: 'reschedule', label: `改约补偿（${reason}）`, amount: -compensate, ruleId: 'R-FAIR-4' })
  b.payStatus = 'refunding'
  tl(b, `管理员改约 ${newStart}–${newEnd}：${reason}；补偿 ${compensate} 元、新时段优先排位（R-FAIR-4）`, 'warning')
}

// ---------- 选择器 ----------
export function courtById(id: string) {
  return state.courts.find(c => c.id === id)!
}
export function bookingById(id: string) {
  return state.bookings.find(b => b.id === id)
}
export function lightLive(b: Booking) {
  const court = state.courts.find(c => c.id === b.courtId)
  const faultIncident = state.incidents.some(i => i.type === 'lightFault' && i.bookingIds.includes(b.id) && (i.status === 'open' || i.status === 'mediating'))
  return lightQuote(b, court, nowStr.value, faultIncident)
}

/** 当前所有生效中的球队夜间限制（社区端/管理员查看） */
export function activeNightRestrictions(): NightRestriction[] {
  const keys = [...new Set(state.nightViolations.map(v => v.teamKey))]
  const out: NightRestriction[] = []
  for (const key of keys) {
    const stats = teamViolationStats(state.nightViolations, key, TODAY)
    const court = state.courts.find(c => c.id === stats?.violations[0]?.courtId)
    const r = buildRestriction(stats, court, TODAY)
    // 仅统计真正的限制（加倍押金 / 限时段 / 暂停）；观察提醒不计入"限制效果"
    if (r && r.level !== 'none' && r.level !== 'watch') out.push(r)
  }
  return out
}

/** 限制生效前后投诉量对比（社区端：限制是否降低投诉） */
export function nightRestrictionEffectList() {
  return restrictionEffects(state.nightViolations, activeNightRestrictions(), TODAY)
}

/** 全社区按日夜间投诉趋势 */
export function nightComplaintsByDay() {
  return complaintsByDay(state.nightViolations)
}

export { feeSummary, RESTRICTION_META }
