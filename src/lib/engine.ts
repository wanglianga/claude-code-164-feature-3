import type {
  Booking, Court, FeeItem, Incident, IncidentType, IncidentStatus, BookingStatus,
  MergeRequest, NoiseRecord, NightRestriction, NightRestrictionLevel,
  PayStatus, SurfaceStatus, HoopStatus
} from '../types'

// ---------- 时间工具 ----------
export function hm(t?: string): number {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
export function fmt(min: number): string {
  const h = Math.floor(Math.abs(min) / 60)
  const m = Math.abs(min) % 60
  const sign = min < 0 ? '-' : ''
  return h > 0 ? `${sign}${h}小时${m > 0 ? m + '分' : ''}` : `${sign}${m}分钟`
}
export function hmLabel(min: number): string {
  const h = Math.floor(min / 60)
  return `${String(h).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}
export function money(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, '')
}

// ---------- 文案映射 ----------
export const SURFACE_META: Record<SurfaceStatus, { label: string; type: 'success' | 'warning' | 'error' | 'default' }> = {
  good: { label: '地面干燥良好', type: 'success' },
  wet: { label: '雨后地面湿滑', type: 'warning' },
  slippery: { label: '地面积水打滑', type: 'error' },
  repair: { label: '地面维修中', type: 'error' }
}
export const HOOP_META: Record<HoopStatus, { label: string; type: 'success' | 'warning' | 'error' | 'default' }> = {
  normal: { label: '正常', type: 'success' },
  maintaining: { label: '维修中', type: 'warning' },
  sealed: { label: '已封停', type: 'error' }
}
export const STATUS_META: Record<BookingStatus, { label: string; type: 'success' | 'warning' | 'error' | 'default' | 'info' }> = {
  booked: { label: '待开场', type: 'info' },
  ongoing: { label: '进行中', type: 'success' },
  finished: { label: '已结束', type: 'default' },
  earlyLeave: { label: '提前离场', type: 'default' },
  late: { label: '迟到进行中', type: 'warning' },
  overtime: { label: '超时占用中', type: 'error' },
  cancelled: { label: '已取消', type: 'default' },
  rescheduled: { label: '已改约', type: 'warning' },
  sealed: { label: '封场未使用', type: 'default' },
  noshow: { label: '爽约', type: 'error' },
  rejected: { label: '审核不通过', type: 'error' }
}
export const PAY_META: Record<PayStatus, { label: string; type: 'success' | 'warning' | 'error' | 'default' | 'info' }> = {
  unpaid: { label: '未支付', type: 'warning' },
  depositPaid: { label: '押金已付', type: 'info' },
  paid: { label: '已结清', type: 'success' },
  refunding: { label: '退款处理中', type: 'warning' },
  refunded: { label: '已退款', type: 'success' },
  deducted: { label: '押金抵扣结清', type: 'default' }
}

export const INCIDENT_META: Record<IncidentType, { label: string; emoji: string }> = {
  rain: { label: '下雨地滑', emoji: '🌧️' },
  repair: { label: '临时维修', emoji: '🔧' },
  hoopDispute: { label: '争抢篮筐', emoji: '🥊' },
  noise: { label: '噪声投诉', emoji: '🔊' },
  minorNight: { label: '未成年人夜留', emoji: '🧒' },
  lightFault: { label: '照明故障', emoji: '💡' },
  seal: { label: '封场', emoji: '🚧' },
  late: { label: '队伍迟到', emoji: '⏰' },
  overtime: { label: '超时占用', emoji: '⌛' },
  refuseMerge: { label: '拒绝拼场', emoji: '🚫' }
}

export const FEE_META: Record<string, { label: string; type: 'success' | 'warning' | 'error' | 'info' | 'default' }> = {
  lighting: { label: '照明费', type: 'info' },
  deposit: { label: '照明押金', type: 'default' },
  late: { label: '迟到占位费', type: 'warning' },
  overtime: { label: '超时占用费', type: 'error' },
  refuseMerge: { label: '拒拼资源占用费', type: 'warning' },
  earlyRefund: { label: '提前离场退还', type: 'success' },
  weather: { label: '天气补偿', type: 'success' },
  complaint: { label: '噪声处罚', type: 'error' },
  sealRefund: { label: '封场退款', type: 'success' },
  reschedule: { label: '改约补偿', type: 'success' },
  nightDeposit: { label: '夜间限制押金', type: 'warning' }
}

// ---------- 照明实时计费 ----------
export interface LightQuote {
  minutes: number
  /** 全场 = 2 个半场单价 */
  gross: number
  /** 勾选接受拼场 8 折（R-BOOK-2 / R-LIGHT-1） */
  rate: number
  fee: number
  /** 拼场按签到人数平摊 */
  perPerson: number
  frozen: boolean
}

export function lightQuote(b: Booking, court: Court | undefined, nowHm: string, frozen = false): LightQuote | null {
  if (!b.lighting.enabled || !court || !b.lighting.onAt) return null
  const endOf = b.lighting.offAt ?? (isActive(b, nowHm) ? nowHm : (b.actualEnd ?? b.end))
  const minutes = Math.max(0, hm(endOf) - hm(b.lighting.onAt))
  const halfFactor = b.scope === 'full' ? 2 : 1
  const gross = minutes * court.lighting.pricePerMinute * halfFactor
  const rate = b.acceptMerge ? 0.8 : 1
  const fee = gross * rate
  const present = Math.max(1, b.members.filter(m => m.checkedIn).length)
  return {
    minutes,
    gross,
    rate,
    fee,
    perPerson: fee / present,
    frozen
  }
}

// ---------- 到场 / 迟到 / 超时 ----------
export function checkedInCount(b: Booking): number {
  return b.members.filter(m => m.checkedIn).length
}

export function isActive(b: Booking, nowHm: string): boolean {
  return ['ongoing', 'late', 'overtime'].includes(b.status) && hm(nowHm) >= hm(b.actualStart ?? b.start)
}

export interface TimeState {
  /** 距离开场分钟数（负=尚未开场） */
  untilStart: number
  /** 迟到分钟数（以签到/当前时间较晚者为准） */
  lateMinutes: number
  /** 剩余可打分钟（进行中；含 5 分钟清场缓冲展示） */
  remaining: number
  /** 超时分钟数（已过结束+5 分钟缓冲） */
  overtimeMinutes: number
  /** 是否进入 5 分钟清场缓冲 */
  inGrace: boolean
  /** 是否超 15 分钟可强制清场（R-OT-2） */
  forceClearable: boolean
  /** 待释放：开场 20 分钟未签到（R-LATE-1 / R-FAIR-2） */
  releasable: boolean
}

export function timeState(b: Booking, nowHm: string): TimeState {
  const now = hm(nowHm)
  const start = hm(b.start)
  const end = hm(b.end)
  const active = isActive(b, nowHm)
  const lateMinutes = b.actualStart
    ? Math.max(0, hm(b.actualStart) - start)
    : (b.status === 'booked' ? Math.max(0, now - start) : 0)
  const overtimeMinutes = active ? Math.max(0, now - (end + 5)) : 0
  return {
    untilStart: start - now,
    lateMinutes,
    remaining: active ? end - now : 0,
    overtimeMinutes,
    inGrace: active && now > end && now <= end + 5,
    forceClearable: overtimeMinutes >= 15,
    releasable: b.status === 'booked' && now - start >= 20
  }
}

/** 迟到占位费：16–20 分钟 10 元（R-LATE-1） */
export function lateFee(b: Booking, nowHm: string): number {
  const lm = timeState(b, nowHm).lateMinutes
  if (lm >= 16) return 10
  return 0
}

/** 超时占用费：第 6 分钟起 2 元/分钟（R-OT-2） */
export function overtimeFee(b: Booking, nowHm: string): number {
  return timeState(b, nowHm).overtimeMinutes * 2
}

// ---------- 费用汇总 ----------
export interface FeeSummary {
  light: LightQuote | null
  /** 规则费用（押金以外的静态条目 + 迟到/超时动态条目），照明条目实时金额另算 */
  items: FeeItem[]
  charges: number
  refunds: number
  deposit: number
  /** 押金扣除已发生费用后的余额（可为负=需补缴） */
  depositBalance: number
  needTopup: boolean
}

export function feeSummary(b: Booking, court: Court | undefined, nowHm: string, lightFrozen = false): FeeSummary {
  const items: FeeItem[] = []
  const light = lightQuote(b, court, nowHm, lightFrozen)
  const lf = lateFee(b, nowHm)
  const of = overtimeFee(b, nowHm)
  for (const f of b.fees) {
    if (f.kind === 'lighting') continue // 照明实时计算
    items.push(f)
  }
  if (lf > 0 && !b.fees.some(f => f.kind === 'late')) {
    items.push({ kind: 'late', label: `迟到占位费（迟到 ${timeState(b, nowHm).lateMinutes} 分钟）`, amount: lf, ruleId: 'R-LATE-1' })
  }
  if (of > 0 && !b.fees.some(f => f.kind === 'overtime')) {
    items.push({ kind: 'overtime', label: `超时占用费（超时 ${timeState(b, nowHm).overtimeMinutes} 分钟 × 2 元）`, amount: of, ruleId: 'R-OT-2' })
  }
  const lightAmount = light?.fee ?? 0
  const charges = items.filter(i => i.amount > 0).reduce((s, i) => s + i.amount, 0) + lightAmount
  const refunds = items.filter(i => i.amount < 0).reduce((s, i) => s + Math.abs(i.amount), 0)
  const deposit = b.lighting.deposit
  const depositBalance = deposit - charges
  return { light, items, charges, refunds, deposit, depositBalance, needTopup: depositBalance < 0 }
}

// ---------- 冲突风险 ----------
export type RiskLevel = 'high' | 'medium' | 'low' | 'none'

export interface RiskView {
  level: RiskLevel
  reasons: string[]
}

const ACTIVE_INCIDENT: IncidentStatus[] = ['open', 'mediating']

export function bookingRisk(b: Booking, incidents: Incident[], nowHm: string): RiskView {
  const reasons: string[] = []
  let level: RiskLevel = 'none'
  const raise = (lv: RiskLevel, r: string) => {
    reasons.push(r)
    if (lv === 'high' || (lv === 'medium' && level !== 'high')) level = lv
    if (lv === 'low' && level === 'none') level = 'low'
  }
  const ts = timeState(b, nowHm)
  if (ts.forceClearable) raise('high', `已超时 ${ts.overtimeMinutes} 分钟，管理员可强制清场（R-OT-2）`)
  else if (ts.overtimeMinutes > 0) raise('high', `超时占用 ${ts.overtimeMinutes} 分钟，正在计费`)
  else if (ts.inGrace) raise('medium', '进入 5 分钟清场缓冲，下一时段队伍待场')
  if (ts.releasable) raise('high', '开场 20 分钟未签到，场地可释放给候补散客（R-LATE-1）')
  if (b.status === 'booked' && ts.lateMinutes > 0 && ts.lateMinutes < 20) raise('medium', `已迟到 ${ts.lateMinutes} 分钟`)
  if (b.credit < 80) raise('medium', `信用分 ${b.credit}（低于 80，冲突排序靠后）`)
  if (b.credit < 60) raise('high', `信用分 ${b.credit}（低于 60，应暂停预约资格）`)
  if (b.nightLock === 2) raise('medium', '夜间限制（level 2）：30 天内仅可约 20:00 前结束时段、押金上浮 50%（R-NIGHT-1）')
  else if (b.nightLock === 1) raise('low', '夜间限制（level 1）：30 天内夜间预约押金上浮 50%（R-NIGHT-1）')

  for (const inc of incidents) {
    if (!inc.bookingIds.includes(b.id) || !ACTIVE_INCIDENT.includes(inc.status)) continue
    switch (inc.type) {
      case 'noise': raise('medium', '居民噪声投诉处理中，再次核实将收费（R-NOISE-1）'); break
      case 'minorNight': raise('medium', '未成年人无监护人陪同，等待监护人接回（R-MINOR-1）'); break
      case 'lightFault': raise('high', '照明故障待核验，费用已冻结（R-LIGHT-3）'); break
      case 'seal': raise('high', '封场令待签发，该预约可能被中止并全额退款（R-SEAL-1）'); break
      case 'rain': raise('medium', '降雨地滑暂停/限制使用（R-WX-1）'); break
      case 'hoopDispute': raise('high', '篮筐使用权争议待裁决（R-DISPUTE-1）'); break
      case 'repair': raise('high', '设施临时维修影响使用（R-WX-2）'); break
      default: raise('medium', '事件处理中')
    }
  }
  if (level === 'none') reasons.push('暂未发现冲突风险')
  return { level, reasons }
}

export function courtRisk(c: Court, bookings: Booking[], incidents: Incident[], nowHm: string): RiskView {
  const reasons: string[] = []
  let level: RiskLevel = 'none'
  const raise = (lv: RiskLevel, r: string) => {
    if (!reasons.includes(r)) reasons.push(r)
    if (lv === 'high' || (lv === 'medium' && level !== 'high')) level = lv
    if (lv === 'low' && level === 'none') level = 'low'
  }
  if (c.sealed) raise('high', `已封场：${c.sealReason ?? ''}`)
  if (c.sealedHalves?.length) raise('high', `${c.sealedHalves.join('/')} 已封停：${c.sealReason ?? ''}`)
  if (c.surface === 'slippery') raise('high', '地面积水打滑，暂停使用')
  else if (c.surface === 'wet') raise('low', '雨后湿滑，请注意防滑')
  else if (c.surface === 'repair') raise('high', '地面维修中')
  if (c.lighting.status === 'fault') raise('high', '照明故障，夜间场次受影响')
  Object.entries(c.hoops).forEach(([h, s]) => {
    if (s === 'maintaining') raise('medium', `${h} 篮筐维修中`)
    if (s === 'sealed') raise('high', `${h} 篮筐已封停`)
  })
  const actives = bookings.filter(b => b.courtId === c.id && isActive(b, nowHm))
  for (const b of actives) {
    const r = bookingRisk(b, incidents, nowHm)
    if (r.level === 'high') raise('high', `${b.halves.join('/')} ${b.teamName}：${r.reasons[0]}`)
    else if (r.level === 'medium') raise('medium', `${b.halves.join('/')} ${b.teamName}：${r.reasons[0]}`)
  }
  for (const inc of incidents) {
    if (inc.courtId !== c.id || !ACTIVE_INCIDENT.includes(inc.status)) continue
    raise(inc.type === 'noise' || inc.type === 'minorNight' ? 'medium' : 'high',
      `${INCIDENT_META[inc.type].emoji} ${inc.title}`)
  }
  if (level === 'none') reasons.push('场地运行正常')
  return { level, reasons }
}

// ---------- 场地占用 / 可用性 ----------
export function bookingsOfHalf(c: Court, half: string, bookings: Booking[]): Booking[] {
  return bookings
    .filter(b => b.courtId === c.id && b.halves.includes(half))
    .sort((a, b2) => hm(a.start) - hm(b2.start))
}

export function halfUsable(c: Court, half: string): boolean {
  if (c.sealed) return false
  if (c.sealedHalves?.includes(half)) return false
  if (c.surface === 'slippery' || c.surface === 'repair') return false
  return c.hoops[half] !== 'maintaining' && c.hoops[half] !== 'sealed'
}

export function halfSealed(c: Court, half: string): boolean {
  return c.sealed || !!c.sealedHalves?.includes(half)
}

export interface SlotOption {
  start: string
  end: string
  /** 该时段可约半场编号（空=全满/不可约） */
  freeHalves: string[]
  fullAvailable: boolean
  label: string
  night: boolean
}

export function slotOptions(c: Court, bookings: Booking[]): SlotOption[] {
  const slots: Array<[string, string]> = [
    ['06:00', '08:00'], ['08:00', '10:00'], ['10:00', '12:00'], ['12:00', '14:00'],
    ['14:00', '16:00'], ['16:00', '18:00'], ['18:00', '20:00'], ['20:00', '22:00']
  ]
  const halfIds = Object.keys(c.hoops)
  return slots.map(([start, end]) => {
    const freeHalves = halfIds.filter(h => {
      if (!halfUsable(c, h)) return false
      const clash = bookingsOfHalf(c, h, bookings).some(b =>
        b.date === '2026-09-27' &&
        ![ 'cancelled', 'noshow', 'rejected'].includes(b.status) &&
        hm(b.start) < hm(end) && hm(b.end) > hm(start))
      return !clash
    })
    return {
      start, end, freeHalves,
      fullAvailable: freeHalves.length >= 2,
      label: `${start}–${end}`,
      night: hm(start) >= hm(`${c.lighting.autoOnHour}:00`)
    }
  })
}

// ---------- 公平性 / 改约解释 ----------
export function fairnessNote(b: Booking): string[] {
  const out: string[] = []
  if (b.status === 'rescheduled') {
    out.push('改约依据 R-FAIR-4：场地安全与维修 > 已支付已签到队伍 > 固定球队固定时段 > 先到先得 > 信用分。')
    out.push(b.adminNote ?? '管理员已给出改约理由与补偿。')
  }
  if (b.fixedTeam) out.push('固定球队资格：提前 7 天预约本周固定时段，但黄金时段固定队总量不超过 60%（R-FAIR-1）。')
  else out.push('散客/临时队伍：开场前 24 小时开放的公共名额可直接预约，与固定球队享同等到场权益（R-FAIR-1）。')
  if (b.credit < 80) out.push(`信用分 ${b.credit}：在场地冲突排序中靠后，建议按时到场、避免超时与投诉以恢复信用。`)
  return out
}

/** 拼场审核辅助：队长拒绝是否可能构成"无正当理由"（R-MERGE-1） */
export function rejectMergeCheck(b: Booking, req: MergeRequest): { unreasonable: boolean; hint: string } {
  const total = checkedInCount(b) + req.people
  if (req.minor) return { unreasonable: false, hint: '申请方含未成年人，夜场须监护人陪同，可作为正当理由（R-MINOR-1）' }
  if (b.headcount + req.people > (b.scope === 'full' ? 14 : 8)) {
    return { unreasonable: false, hint: '拼入后超出半场/全场建议人数上限，可作为正当理由' }
  }
  if (total >= 6) return { unreasonable: true, hint: '拼入后达到半场合理人数（≥6 人），无理由拒绝将收 20 元资源占用费并扣信用 5 分（R-MERGE-1）' }
  return { unreasonable: false, hint: '当前人数不足，建议同意拼场以提高场地利用率' }
}

// ---------- 夜间限制（R-NIGHT-1） ----------
export const NIGHT_WINDOW_DAYS = 90
export const NIGHT_RESTRICT_DAYS = 30
export const NIGHT_DEPOSIT_EXTRA = 0.5
/** level 2：仅可预约结束时间不晚于此时刻的时段 */
export const NIGHT_LEVEL2_END = '20:00'

function daysBetween(a: string, b: string): number {
  const [ya, ma, da] = a.split('-').map(Number)
  const [yb, mb, db] = b.split('-').map(Number)
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86400000)
}

/** 一次投诉是否构成"经现场核实的噪声违规"（首次劝导计 1 次、二次核实收费计 1 次） */
export function isNoiseViolation(r: NoiseRecord): boolean {
  return (r.outcome === 'firstWarned' || r.outcome === 'secondFined')
    && r.reminders.some(x => x.verified)
}

/** 同一球队的夜间限制画像（按队长实名手机号归并，90 天窗口） */
export function teamRestriction(teamKey: string, records: NoiseRecord[], today = '2026-09-27'): NightRestriction {
  const inWindow = records
    .filter(r => r.teamKey === teamKey && daysBetween(r.date, today) >= 0 && daysBetween(r.date, today) <= NIGHT_WINDOW_DAYS)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
  const vios = inWindow.filter(isNoiseViolation)
  const latest = vios[vios.length - 1]
  const active = !!latest && daysBetween(latest.date, today) <= NIGHT_RESTRICT_DAYS && vios.length >= 2
  let level: NightRestrictionLevel = 0
  if (active) level = vios.length >= 3 ? 2 : 1
  const reasonLines = vios.map((r, i) => {
    const db = r.reminders.find(x => x.db)?.db
    return `${i + 1}. ${r.date} ${r.time} ${r.outcome === 'secondFined' ? '24h 内第 2 次核实，收社区安宁费 50 元' : '现场核实首次劝导'}${db ? `（实测 ${db}dB）` : ''}，${r.lightOffAt ? r.lightOffAt + ' 关灯离场' : '处置见记录'}`
  })
  const reason = level > 0
    ? `近 ${NIGHT_WINDOW_DAYS} 天内经核实噪声违规 ${vios.length} 次：\n${reasonLines.join('\n')}。最近一次 ${latest!.date}，限制期至该日起 ${NIGHT_RESTRICT_DAYS} 天；期内再违规将重新起算。`
    : ''
  return {
    level,
    violations: vios.length,
    records: inWindow,
    depositExtra: level >= 1 ? NIGHT_DEPOSIT_EXTRA : 0,
    latestEnd: level >= 2 ? NIGHT_LEVEL2_END : undefined,
    reason
  }
}

/** 按预约（队长手机号）取限制画像；新预约表单未填手机号时回退按姓名匹配 */
export function restrictionOf(b: Pick<Booking, 'captainPhone' | 'captainName'>, records: NoiseRecord[], today = '2026-09-27'): NightRestriction {
  let r = teamRestriction(b.captainPhone, records, today)
  if (r.records.length === 0 && b.captainName) {
    const key = records.find(x => x.captainName === b.captainName)?.teamKey
    if (key) r = teamRestriction(key, records, today)
  }
  return r
}

/** 夜间限制押金（level≥1 上浮 50%，半场 50→75、全场 100→150） */
export function nightDeposit(base: number, level: NightRestrictionLevel): number {
  return level >= 1 ? Math.round(base * (1 + NIGHT_DEPOSIT_EXTRA)) : base
}

/** level 2 时段限制：所选时段结束时间晚于 20:00 则不可约 */
export function slotBlockedByNight(end: string, r: NightRestriction): boolean {
  return r.level >= 2 && hm(end) > hm(NIGHT_LEVEL2_END)
}

/**
 * 平台统一结束（关灯离场）时间：夜间场次不得晚于场地静音截止。
 * 用于向队长与队员公示同一口径，避免队长口头承诺与平台规则不一致。
 */
export function platformEndTime(b: Pick<Booking, 'start' | 'end'>, court: Court): string {
  const curfew = `${String(court.noiseCurfew).padStart(2, '0')}:00`
  return hm(b.start) >= hm(`${court.lighting.autoOnHour}:00`) && hm(b.end) > hm(curfew) ? curfew : b.end
}

// ---------- 夜间限制效果（社区端） ----------
export interface NightEffectRow {
  teamKey: string
  teamName: string
  level: NightRestrictionLevel
  /** 限制生效日（第 2 次违规日期） */
  restrictedAt: string
  daysActive: number
  /** 生效前 30 天 */
  beforeVerified: number
  beforeTotal: number
  /** 生效后（不含触发当日） */
  afterVerified: number
  afterTotal: number
  afterUnverified: number
  pending: number
  /** 限制后最近一次关灯时间 */
  lastLightOffAt?: string
  trend: 'down' | 'flat' | 'up'
}

export function nightRestrictionEffect(records: NoiseRecord[], today = '2026-09-27'): { rows: NightEffectRow[]; beforeVerified: number; afterVerified: number; afterUnverified: number; pending: number } {
  const keys = [...new Set(records.map(r => r.teamKey))]
  const rows: NightEffectRow[] = []
  for (const key of keys) {
    const rs = records.filter(r => r.teamKey === key)
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    const vios = rs.filter(isNoiseViolation)
    if (vios.length < 2) continue
    // 当前限制等级生效日：level 2 取第 3 次违规日，level 1 取第 2 次违规日
    const levelNow = teamRestriction(key, records, today).level
    const restrictedAt = vios[Math.min(vios.length, levelNow >= 2 ? 3 : 2) - 1].date
    const before = rs.filter(r => daysBetween(r.date, restrictedAt) > 0 && daysBetween(r.date, restrictedAt) <= 30)
    const after = rs.filter(r => daysBetween(restrictedAt, r.date) > 0 && daysBetween(r.date, today) >= 0)
    const afterV = after.filter(isNoiseViolation).length
    const beforeV = before.filter(isNoiseViolation).length
    rows.push({
      teamKey: key,
      teamName: vios[vios.length - 1].teamName,
      level: teamRestriction(key, records, today).level,
      restrictedAt,
      daysActive: daysBetween(restrictedAt, today),
      beforeVerified: beforeV,
      beforeTotal: before.length,
      afterVerified: afterV,
      afterTotal: after.length,
      afterUnverified: after.filter(r => r.outcome === 'unverified').length,
      pending: after.filter(r => r.outcome === 'open').length,
      lastLightOffAt: after.filter(r => r.lightOffAt).pop()?.lightOffAt,
      trend: afterV < beforeV ? 'down' : afterV > beforeV ? 'up' : 'flat'
    })
  }
  rows.sort((a, b) => a.restrictedAt.localeCompare(b.restrictedAt))
  return {
    rows,
    beforeVerified: rows.reduce((s, r) => s + r.beforeVerified, 0),
    afterVerified: rows.reduce((s, r) => s + r.afterVerified, 0),
    afterUnverified: rows.reduce((s, r) => s + r.afterUnverified, 0),
    pending: rows.reduce((s, r) => s + r.pending, 0)
  }
}
