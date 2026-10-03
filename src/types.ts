// ============ 领域类型定义 ============

export type RoleId = 'captain' | 'walkin' | 'admin' | 'worker'

export interface Role {
  id: RoleId
  name: string
  emoji: string
  desc: string
}

/** 场地地面状况 */
export type SurfaceStatus = 'good' | 'wet' | 'slippery' | 'repair'
/** 篮筐状态 */
export type HoopStatus = 'normal' | 'maintaining' | 'sealed'

export interface Court {
  id: string
  name: string
  park: string
  /** 可划分半场数量（全场 = 2 个半场） */
  halfCourts: number
  surface: SurfaceStatus
  /** 各篮筐状态，按半场编号 */
  hoops: Record<string, HoopStatus>
  /** 附近噪声敏感小区 */
  noiseSensitive: string[]
  /** 噪声截止时间（小时，22 表示 22:00 后须静音/关灯） */
  noiseCurfew: number
  lockersTotal: number
  lockersFree: number
  /** 照明元数据 */
  lighting: {
    available: boolean
    /** 每半场每分钟单价（元） */
    pricePerMinute: number
    /** 照明起步开启时间（小时，18 表示 18:00 起可开灯） */
    autoOnHour: number
    /** 押金（元） */
    deposit: number
    status: 'ok' | 'fault' | 'off'
  }
  /** 距离（米），仅展示用 */
  distanceM: number
  sealed: boolean
  sealReason?: string
  /** 部分封场（如仅封 H3/H4），为空表示全场地封停 */
  sealedHalves?: string[]
}

export type Scope = 'half' | 'full'
export type BookingStatus =
  | 'booked'        // 已预约待开始
  | 'ongoing'       // 进行中
  | 'finished'      // 正常结束
  | 'earlyLeave'    // 提前离场
  | 'late'          // 迟到（进行中但触发迟到规则）
  | 'overtime'      // 超时占用
  | 'cancelled'     // 取消
  | 'rescheduled'   // 被改约
  | 'sealed'        // 封场未使用
  | 'noshow'        // 爽约
  | 'rejected'      // 审核不通过

export type PayStatus = 'unpaid' | 'depositPaid' | 'paid' | 'refunding' | 'refunded' | 'deducted'

export interface Member {
  id: string
  name: string
  phone: string
  isCaptain: boolean
  checkedIn: boolean
  checkInAt?: string // HH:mm
  /** 未成年人需监护人陪同夜场 */
  minor?: boolean
}

/** 照明实际使用记录 */
export interface LightingUsage {
  enabled: boolean
  /** 实际开灯时间 HH:mm */
  onAt?: string
  /** 实际关灯时间 HH:mm（未关则按当前/结束时间计） */
  offAt?: string
  minutes: number
  fee: number
  deposit: number
}

export type FeeItemKind =
  | 'lighting'      // 照明费
  | 'deposit'       // 押金
  | 'late'          // 迟到扣费
  | 'overtime'      // 超时占用费
  | 'refuseMerge'  // 拒绝拼场资源占用费
  | 'earlyRefund'  // 提前离场退还
  | 'weather'      // 天气/维修补偿
  | 'complaint'    // 噪声投诉处罚
  | 'sealRefund'   // 封场全额退款
  | 'reschedule'   // 改约补偿

export interface FeeItem {
  kind: FeeItemKind
  label: string
  amount: number   // 正=收取，负=退还/抵扣
  ruleId: string
  note?: string
}

export type IncidentType =
  | 'rain'            // 下雨地滑
  | 'repair'          // 临时维修
  | 'hoopDispute'     // 争抢篮筐
  | 'noise'           // 噪声投诉
  | 'minorNight'      // 未成年人夜间滞留
  | 'lightFault'      // 照明故障
  | 'seal'            // 管理员封场
  | 'late'            // 队伍迟到
  | 'overtime'        // 超时占用
  | 'refuseMerge'    // 拒绝拼场

export type IncidentStatus = 'open' | 'mediating' | 'resolved' | 'penalized'

export interface Incident {
  id: string
  type: IncidentType
  courtId: string
  bookingIds: string[]
  title: string
  desc: string
  source: string // 投诉人/上报人
  time: string   // HH:mm
  /** 工单日期（历史工单用，默认今日 TODAY） */
  date?: string
  status: IncidentStatus
  /** 处置记录（时间线） */
  actions: IncidentAction[]
  /** 关联的费用/补偿条目，已在结算时写入 booking */
  ruleApplied?: string[]
  /** 后续处罚 */
  penalty?: string
  /** 夜间噪声四要素（噪声工单专用：投诉时间/关灯时间/现场提醒） */
  nightRecord?: {
    complaintTime: string
    lightsOffAt: string
    reminder: string
    reminderBy: RoleId
    noiseDb?: number
  }
}

export interface IncidentAction {
  at: string
  by: RoleId
  text: string
}

/**
 * 夜间噪声违规记录（居民连续投诉 22:00 后噪声的留痕）。
 * 一次核实即一条；把"投诉时间 / 使用队伍 / 照明关闭时间 / 管理员现场提醒"
 * 四要素固定记录在一起，作为后续夜间限制与押金升级的依据。
 */
export interface NightViolation {
  id: string
  /** 稳定球队标识（与 Booking.teamKey 一致，缺省为队名） */
  teamKey: string
  /** 投诉时间（居民来电/登记时间，HH:mm） */
  complaintTime: string
  /** 关联预约（场地使用队伍） */
  bookingId: string
  teamName: string
  courtId: string
  courtName: string
  /** 投诉人/来源 */
  source: string
  /** 实测噪声（分贝，可空） */
  noiseDb?: number
  /** 静音截止时间（HH:mm，取自场地 noiseCurfew） */
  curfew: string
  /** 照明实际/要求关闭时间（HH:mm） */
  lightsOffAt: string
  /** 现场提醒/劝导文字 */
  reminder: string
  /** 现场提醒人（管理员/社区工作人员） */
  reminderBy: RoleId
  /** 是否 24h 内第 2 次核实（收费） */
  secondIn24h: boolean
  /** 已收社区安宁费（元） */
  fee: number
  /** 发生日期（演示用，用于限制生效前后的投诉对比） */
  date: string
  /** 关联工单 */
  incidentId: string
}

/** 队伍夜间限制等级（多次噪声违规后递进） */
export type NightRestrictionLevel = 'none' | 'watch' | 'elevatedDeposit' | 'timeLimited' | 'suspended'

export interface NightRestriction {
  teamKey: string
  teamName: string
  level: NightRestrictionLevel
  /** 生效起始日期 */
  since: string
  /** 历史违规原因（面向队长公示） */
  reasons: string[]
  /** 本次夜间预约押金规则说明 */
  depositRule: string
  /** 押金倍数/金额（半场，全场 ×2） */
  depositHalf: number
  /** 允许预约的最晚结束时间（HH:mm），空表示不限制时段 */
  latestEnd?: string
  /** 累计违规次数 */
  violationCount: number
  /** 最近一次违规时间 */
  lastAt: string
}

/** 拼场申请 */
export interface MergeRequest {
  id: string
  bookingId: string
  walkerName: string
  walkerPhone: string
  people: number
  minor?: boolean
  message: string
  status: 'pending' | 'accepted' | 'rejected'
  /** 队长拒绝是否被判为"无正当理由拒拼" */
  unreasonable?: boolean
  time: string
}

export interface Booking {
  id: string
  code: string
  courtId: string
  /** 使用的半场编号列表，全场占两个 */
  halves: string[]
  scope: Scope
  date: string        // YYYY-MM-DD
  start: string       // HH:mm
  end: string
  /** 实际开始 / 结束（迟到、提前离场、超时用） */
  actualStart?: string
  actualEnd?: string
  headcount: number
  acceptMerge: boolean
  teamName: string
  captainId: string
  captainName: string
  captainPhone: string
  members: Member[]
  status: BookingStatus
  payStatus: PayStatus
  lighting: LightingUsage
  fees: FeeItem[]
  /** 固定球队优先标识（公平性说明用） */
  fixedTeam?: boolean
  /** 历史履约信用分（初始 100） */
  credit: number
  /** 管理员改约/限制原因 */
  adminNote?: string
  /** 稳定的球队标识（用于跨预约聚合历史噪声违规）；缺省回退为队名 */
  teamKey?: string
  /** 预约时适用的夜间限制快照（高押金/限时段 + 历史违规原因），提交前向队长公示 */
  nightRestriction?: {
    level: NightRestrictionLevel
    depositHalf: number
    latestEnd?: string
    reasons: string[]
    depositRule: string
  }
  /** 权益/核验时间线 */
  timeline: TimelineEvent[]
  /** 签到码 */
  checkInCode: string
  lockerNos?: number[]
}

export interface TimelineEvent {
  at: string
  text: string
  tone?: 'default' | 'success' | 'warning' | 'error' | 'info'
}

export interface RuleText {
  id: string
  chapter: string
  title: string
  body: string
}
