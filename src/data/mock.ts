import type { Booking, Court, Incident, MergeRequest, NoiseRecord, Role } from '../types'

/** 演示用"当前时间"：晚间黄金时段，照明已开，多个场次并行，冲突丰富 */
export const TODAY = '2026-09-27'
export const NOW_HM = '19:42'

export const ROLES: Role[] = [
  { id: 'captain', name: '陈晨（队长）', emoji: '🏀', desc: '晨光队队长，正在 A 区 H1 打球' },
  { id: 'walkin', name: '王同学（散客）', emoji: '🏃', desc: '一个人来，想找人拼场' },
  { id: 'admin', name: '老周（管理员）', emoji: '📋', desc: '场地运营管理员，负责核验与处置' },
  { id: 'worker', name: '林芳（社区工作人员）', emoji: '🏘️', desc: '负责噪声劝导、未成年人巡查与调解' }
]

export const COURTS: Court[] = [
  {
    id: 'court-1',
    name: '滨江社区篮球场 · A区',
    park: '滨江社区体育公园',
    halfCourts: 2,
    surface: 'wet',
    hoops: { H1: 'normal', H2: 'normal' },
    noiseSensitive: ['望江新村 3 栋（距边线 45m）', '望江新村 5 栋（距边线 60m）'],
    noiseCurfew: 21,
    lockersTotal: 20,
    lockersFree: 7,
    lighting: { available: true, pricePerMinute: 0.8, autoOnHour: 18, deposit: 50, status: 'ok' },
    distanceM: 320,
    sealed: false
  },
  {
    id: 'court-2',
    name: '滨江社区篮球场 · B区',
    park: '滨江社区体育公园',
    halfCourts: 2,
    surface: 'good',
    hoops: { H1: 'normal', H2: 'maintaining' },
    noiseSensitive: ['望江新村 5 栋（距边线 90m）'],
    noiseCurfew: 22,
    lockersTotal: 16,
    lockersFree: 3,
    lighting: { available: true, pricePerMinute: 0.8, autoOnHour: 18, deposit: 50, status: 'fault' },
    distanceM: 350,
    sealed: false
  },
  {
    id: 'court-3',
    name: '河滨公园灯光球场',
    park: '河滨公园',
    halfCourts: 4,
    surface: 'good',
    hoops: { H1: 'normal', H2: 'normal', H3: 'normal', H4: 'normal' },
    noiseSensitive: ['河滨公寓 2 号楼（距边线 120m）'],
    noiseCurfew: 22,
    lockersTotal: 24,
    lockersFree: 11,
    lighting: { available: true, pricePerMinute: 1.0, autoOnHour: 18, deposit: 50, status: 'ok' },
    distanceM: 1200,
    sealed: false
  }
]

export const BOOKINGS: Booking[] = [
  {
    id: 'B001',
    code: '836291',
    courtId: 'court-1',
    halves: ['H1'],
    scope: 'half',
    date: TODAY,
    start: '18:00',
    end: '20:00',
    actualStart: '18:02',
    headcount: 7,
    acceptMerge: true,
    teamName: '晨光队（固定球队）',
    captainId: 'u-chen',
    captainName: '陈晨',
    captainPhone: '138****0001',
    fixedTeam: true,
    credit: 92,
    status: 'ongoing',
    payStatus: 'depositPaid',
    checkInCode: '836291',
    lockerNos: [12, 13],
    lighting: { enabled: true, onAt: '18:05', minutes: 0, fee: 0, deposit: 50 },
    fees: [
      { kind: 'lighting', label: '照明费（实时累计，拼场按人均分摊）', amount: 0, ruleId: 'R-LIGHT-1' }
    ],
    members: [
      { id: 'm1-1', name: '陈晨', phone: '138****0001', isCaptain: true, checkedIn: true, checkInAt: '18:02' },
      { id: 'm1-2', name: '李磊', phone: '138****1102', isCaptain: false, checkedIn: true, checkInAt: '18:03' },
      { id: 'm1-3', name: '王芳', phone: '138****1103', isCaptain: false, checkedIn: true, checkInAt: '18:05' },
      { id: 'm1-4', name: '赵强', phone: '138****1104', isCaptain: false, checkedIn: true, checkInAt: '18:06' },
      { id: 'm1-5', name: '孙鹏', phone: '138****1105', isCaptain: false, checkedIn: false },
      { id: 'm1-6', name: '周敏', phone: '138****1106', isCaptain: false, checkedIn: true, checkInAt: '18:10' },
      { id: 'm1-7', name: '赵磊（拼场散客）', phone: '139****7788', isCaptain: false, checkedIn: true, checkInAt: '18:20' }
    ],
    timeline: [
      { at: '09:12', text: '固定球队周预约成功，预付照明押金 50 元', tone: 'success' },
      { at: '18:02', text: '队长陈晨到场，凭签到码 836291 签到', tone: 'success' },
      { at: '18:05', text: '夜间照明开启，开始按 0.8 元/分钟计费', tone: 'info' },
      { at: '18:15', text: '散客赵磊申请拼场，队长同意，照明费改为 7 人均摊（8 折）', tone: 'success' }
    ]
  },
  {
    id: 'B002',
    code: '771045',
    courtId: 'court-1',
    halves: ['H2'],
    scope: 'half',
    date: TODAY,
    start: '18:00',
    end: '20:00',
    actualStart: '18:23',
    headcount: 5,
    acceptMerge: false,
    teamName: '散客联队',
    captainId: 'u-zhou',
    captainName: '周浩',
    captainPhone: '137****2201',
    fixedTeam: false,
    credit: 78,
    nightLock: 1,
    status: 'ongoing',
    payStatus: 'depositPaid',
    checkInCode: '771045',
    lockerNos: [18],
    lighting: { enabled: true, onAt: '18:25', minutes: 0, fee: 0, deposit: 75 },
    fees: [
      { kind: 'refuseMerge', label: '无正当理由拒绝拼场 · 资源占用费', amount: 20, ruleId: 'R-MERGE-1', note: '散客申请 2 人补位至 7 人，队长拒绝且未填写理由' },
      { kind: 'lighting', label: '照明费（实时累计）', amount: 0, ruleId: 'R-LIGHT-1' }
    ],
    members: [
      { id: 'm2-1', name: '周浩', phone: '137****2201', isCaptain: true, checkedIn: true, checkInAt: '18:23' },
      { id: 'm2-2', name: '吴迪', phone: '137****2202', isCaptain: false, checkedIn: true, checkInAt: '18:24' },
      { id: 'm2-3', name: '郑凯（16岁）', phone: '137****2203', isCaptain: false, checkedIn: true, checkInAt: '18:25', minor: true },
      { id: 'm2-4', name: '钱多', phone: '137****2204', isCaptain: false, checkedIn: true, checkInAt: '18:25' },
      { id: 'm2-5', name: '冯伟', phone: '137****2205', isCaptain: false, checkedIn: false }
    ],
    timeline: [
      { at: '09:18', text: '预约时识别到 9/13、9/20 两次经核实噪声违规：夜间限制 L1，押金按上浮 50% 收取 75 元（R-NIGHT-1）', tone: 'warning' },
      { at: '17:40', text: '预约成功，未勾选"接受拼场"', tone: 'default' },
      { at: '17:52', text: '散客申请拼场（2 人），队长未在 10 分钟内处理且拒绝', tone: 'warning' },
      { at: '18:11', text: '系统判定无正当理由拒拼，收取资源占用费 20 元，信用 -5', tone: 'error' },
      { at: '18:23', text: '队伍迟到 23 分钟签到，触发迟到占位费 10 元', tone: 'error' },
      { at: '18:25', text: '照明开启，开始计费', tone: 'info' }
    ]
  },
  {
    id: 'B003',
    code: '592310',
    courtId: 'court-3',
    halves: ['H1', 'H2'],
    scope: 'full',
    date: TODAY,
    start: '19:00',
    end: '21:00',
    actualStart: '19:01',
    headcount: 10,
    acceptMerge: true,
    teamName: '烈风队（固定球队）',
    captainId: 'u-han',
    captainName: '韩磊',
    captainPhone: '136****3301',
    fixedTeam: true,
    credit: 95,
    status: 'ongoing',
    payStatus: 'depositPaid',
    checkInCode: '592310',
    lockerNos: [1, 2, 3],
    lighting: { enabled: true, onAt: '19:02', minutes: 0, fee: 0, deposit: 100 },
    fees: [
      { kind: 'lighting', label: '照明费（全场 ×2 半场，实时累计）', amount: 0, ruleId: 'R-LIGHT-1' }
    ],
    members: [
      { id: 'm3-1', name: '韩磊', phone: '136****3301', isCaptain: true, checkedIn: true, checkInAt: '19:01' },
      { id: 'm3-2', name: '马超', phone: '136****3302', isCaptain: false, checkedIn: true, checkInAt: '19:01' },
      { id: 'm3-3', name: '朱婷', phone: '136****3303', isCaptain: false, checkedIn: true, checkInAt: '19:03' },
      { id: 'm3-4', name: '胡军', phone: '136****3304', isCaptain: false, checkedIn: true, checkInAt: '19:04' },
      { id: 'm3-5', name: '林涛', phone: '136****3305', isCaptain: false, checkedIn: true, checkInAt: '19:05' },
      { id: 'm3-6', name: '黄磊', phone: '136****3306', isCaptain: false, checkedIn: true, checkInAt: '19:06' },
      { id: 'm3-7', name: '徐亮', phone: '136****3307', isCaptain: false, checkedIn: true, checkInAt: '19:08' },
      { id: 'm3-8', name: '高翔', phone: '136****3308', isCaptain: false, checkedIn: true, checkInAt: '19:10' },
      { id: 'm3-9', name: '何帆', phone: '136****3309', isCaptain: false, checkedIn: true, checkInAt: '19:12' },
      { id: 'm3-10', name: '罗成', phone: '136****3310', isCaptain: false, checkedIn: false }
    ],
    timeline: [
      { at: '09:20', text: '固定球队周预约成功（全场），预付照明押金 100 元', tone: 'success' },
      { at: '19:01', text: '全队签到 9/10，照明开启', tone: 'success' }
    ]
  },
  {
    id: 'B004',
    code: '448207',
    courtId: 'court-2',
    halves: ['H1'],
    scope: 'half',
    date: TODAY,
    start: '18:00',
    end: '20:00',
    actualStart: '18:02',
    headcount: 6,
    acceptMerge: true,
    teamName: '湖畔队',
    captainId: 'u-he',
    captainName: '何莉',
    captainPhone: '135****4401',
    fixedTeam: false,
    credit: 88,
    status: 'ongoing',
    payStatus: 'depositPaid',
    checkInCode: '448207',
    lockerNos: [5],
    lighting: { enabled: true, onAt: '18:03', offAt: '18:36', minutes: 33, fee: 26.4, deposit: 50 },
    fees: [
      { kind: 'lighting', label: '照明费（故障前已用 33 分钟，待核验冻结）', amount: 26.4, ruleId: 'R-LIGHT-1' }
    ],
    members: [
      { id: 'm4-1', name: '何莉', phone: '135****4401', isCaptain: true, checkedIn: true, checkInAt: '18:02' },
      { id: 'm4-2', name: '梁欣', phone: '135****4402', isCaptain: false, checkedIn: true, checkInAt: '18:04' },
      { id: 'm4-3', name: '宋佳', phone: '135****4403', isCaptain: false, checkedIn: true, checkInAt: '18:05' },
      { id: 'm4-4', name: '唐艺', phone: '135****4404', isCaptain: false, checkedIn: true, checkInAt: '18:06' },
      { id: 'm4-5', name: '许晴', phone: '135****4405', isCaptain: false, checkedIn: true, checkInAt: '18:08' },
      { id: 'm4-6', name: '邓琳', phone: '135****4406', isCaptain: false, checkedIn: true, checkInAt: '18:10' }
    ],
    timeline: [
      { at: '18:02', text: '签到 6/6，照明开启', tone: 'success' },
      { at: '18:36', text: '队员上报 H1 照明灯闪烁熄灭，队长暂停使用并申请核验', tone: 'warning' }
    ]
  },
  {
    id: 'B005',
    code: '310964',
    courtId: 'court-2',
    halves: ['H2'],
    scope: 'half',
    date: TODAY,
    start: '17:00',
    end: '19:00',
    headcount: 8,
    acceptMerge: true,
    teamName: '夕阳老年队',
    captainId: 'u-yang',
    captainName: '杨广',
    captainPhone: '134****5501',
    fixedTeam: false,
    credit: 90,
    status: 'rescheduled',
    payStatus: 'refunded',
    checkInCode: '310964',
    adminNote: 'H2 篮筐篮板松动紧急维修，已协助改约至明日（9/28）17:00–19:00 同场地，享优先排位，交通补偿 5 元已原路退回。',
    lighting: { enabled: false, minutes: 0, fee: 0, deposit: 0 },
    fees: [
      { kind: 'reschedule', label: '临时维修改约 · 交通补偿 + 全额退款', amount: -5, ruleId: 'R-WX-2', note: '场地费 0 元（免费场地），补偿 5 元；明日同场地优先排位' }
    ],
    members: [
      { id: 'm5-1', name: '杨广', phone: '134****5501', isCaptain: true, checkedIn: false },
      { id: 'm5-2', name: '苏琴', phone: '134****5502', isCaptain: false, checkedIn: false },
      { id: 'm5-3', name: '范理', phone: '134****5503', isCaptain: false, checkedIn: false },
      { id: 'm5-4', name: '潘华', phone: '134****5504', isCaptain: false, checkedIn: false },
      { id: 'm5-5', name: '邓刚', phone: '134****5505', isCaptain: false, checkedIn: false },
      { id: 'm5-6', name: '傅红', phone: '134****5506', isCaptain: false, checkedIn: false },
      { id: 'm5-7', name: '沈建', phone: '134****5507', isCaptain: false, checkedIn: false },
      { id: 'm5-8', name: '曾丽', phone: '134****5508', isCaptain: false, checkedIn: false }
    ],
    timeline: [
      { at: '09:30', text: '预约成功', tone: 'success' },
      { at: '15:40', text: '管理员巡检发现 H2 篮筐篮板松动，发布紧急维修公告', tone: 'warning' },
      { at: '15:45', text: '队长收到短信通知，选择"改约 + 交通补偿"', tone: 'info' },
      { at: '15:46', text: '已改约 9/28 17:00 同场地（优先排位），退款与补偿 1–3 个工作日到账', tone: 'success' }
    ]
  },
  {
    id: 'B006',
    code: '205178',
    courtId: 'court-3',
    halves: ['H1'],
    scope: 'half',
    date: TODAY,
    start: '16:00',
    end: '18:00',
    actualStart: '16:00',
    actualEnd: '18:12',
    headcount: 6,
    acceptMerge: false,
    teamName: '周末斗牛团',
    captainId: 'u-wu',
    captainName: '吴勇',
    captainPhone: '133****6601',
    fixedTeam: false,
    credit: 85,
    status: 'finished',
    payStatus: 'deducted',
    checkInCode: '205178',
    lighting: { enabled: true, onAt: '17:30', offAt: '18:12', minutes: 42, fee: 42, deposit: 50 },
    fees: [
      { kind: 'lighting', label: '照明费 42 分钟 × 1.0 元', amount: 42, ruleId: 'R-LIGHT-1' },
      { kind: 'overtime', label: '超时占用 7 分钟 × 2 元（含 5 分钟清场缓冲）', amount: 14, ruleId: 'R-OT-2', note: '18:05 起计，18:12 离场' }
    ],
    members: [
      { id: 'm6-1', name: '吴勇', phone: '133****6601', isCaptain: true, checkedIn: true, checkInAt: '16:00' },
      { id: 'm6-2', name: '郑国', phone: '133****6602', isCaptain: false, checkedIn: true, checkInAt: '16:02' },
      { id: 'm6-3', name: '王猛', phone: '133****6603', isCaptain: false, checkedIn: true, checkInAt: '16:03' },
      { id: 'm6-4', name: '冯磊', phone: '133****6604', isCaptain: false, checkedIn: true, checkInAt: '16:05' },
      { id: 'm6-5', name: '陈兵', phone: '133****6605', isCaptain: false, checkedIn: true, checkInAt: '16:06' },
      { id: 'm6-6', name: '褚卫', phone: '133****6606', isCaptain: false, checkedIn: true, checkInAt: '16:10' }
    ],
    timeline: [
      { at: '16:00', text: '签到 6/6', tone: 'success' },
      { at: '17:30', text: '照明开启', tone: 'info' },
      { at: '18:00', text: '时段结束，进入 5 分钟清场缓冲', tone: 'warning' },
      { at: '18:05', text: '未离场，开始计超时占用费 2 元/分钟', tone: 'error' },
      { at: '18:12', text: '离场关灯。照明 42 元 + 超时 14 元，押金 50 抵扣后退 0 元、补缴 6 元', tone: 'warning' },
      { at: '18:13', text: '补缴完成，信用 -3（累计超时一次）', tone: 'default' }
    ]
  },
  {
    id: 'B007',
    code: '660283',
    courtId: 'court-1',
    halves: ['H1'],
    scope: 'half',
    date: TODAY,
    start: '20:00',
    end: '22:00',
    headcount: 4,
    acceptMerge: true,
    teamName: '小李快攻队',
    captainId: 'u-li',
    captainName: '李一一',
    captainPhone: '132****7701',
    fixedTeam: false,
    credit: 100,
    status: 'booked',
    payStatus: 'unpaid',
    checkInCode: '660283',
    lighting: { enabled: false, minutes: 0, fee: 0, deposit: 0 },
    fees: [],
    members: [
      { id: 'm7-1', name: '李一一', phone: '132****7701', isCaptain: true, checkedIn: false },
      { id: 'm7-2', name: '赵敏', phone: '132****7702', isCaptain: false, checkedIn: false },
      { id: 'm7-3', name: '钱进', phone: '132****7703', isCaptain: false, checkedIn: false },
      { id: 'm7-4', name: '孙悦', phone: '132****7704', isCaptain: false, checkedIn: false }
    ],
    timeline: [
      { at: '19:05', text: '预约成功（接受拼场），待开场签到与押金支付', tone: 'success' },
      { at: '19:20', text: '已有 2 组散客关注该场次，开场后可在"找拼场"中申请', tone: 'info' }
    ]
  },
  {
    id: 'B008',
    code: '660284',
    courtId: 'court-1',
    halves: ['H2'],
    scope: 'half',
    date: TODAY,
    start: '20:00',
    end: '22:00',
    headcount: 3,
    acceptMerge: false,
    teamName: '临时三人组',
    captainId: 'u-feng',
    captainName: '冯大刚',
    captainPhone: '132****8801',
    fixedTeam: false,
    credit: 96,
    status: 'booked',
    payStatus: 'unpaid',
    checkInCode: '660284',
    lighting: { enabled: false, minutes: 0, fee: 0, deposit: 0 },
    fees: [],
    members: [
      { id: 'm8-1', name: '冯大刚', phone: '132****8801', isCaptain: true, checkedIn: false },
      { id: 'm8-2', name: '陈三', phone: '132****8802', isCaptain: false, checkedIn: false },
      { id: 'm8-3', name: '褚四', phone: '132****8803', isCaptain: false, checkedIn: false }
    ],
    timeline: [
      { at: '19:22', text: '预约成功（未接受拼场，人数偏少，系统已建议拼场）', tone: 'warning' }
    ]
  },
  {
    id: 'B009',
    code: '904512',
    courtId: 'court-3',
    halves: ['H3', 'H4'],
    scope: 'full',
    date: TODAY,
    start: '21:00',
    end: '22:30',
    headcount: 10,
    acceptMerge: true,
    teamName: '星舰队',
    captainId: 'u-xing',
    captainName: '邢舟',
    captainPhone: '131****9901',
    fixedTeam: false,
    credit: 91,
    status: 'booked',
    payStatus: 'unpaid',
    checkInCode: '904512',
    lighting: { enabled: false, minutes: 0, fee: 0, deposit: 0 },
    fees: [],
    members: [
      { id: 'm9-1', name: '邢舟', phone: '131****9901', isCaptain: true, checkedIn: false },
      { id: 'm9-2', name: '于海', phone: '131****9902', isCaptain: false, checkedIn: false },
      { id: 'm9-3', name: '蓝宇', phone: '131****9903', isCaptain: false, checkedIn: false },
      { id: 'm9-4', name: '白雪', phone: '131****9904', isCaptain: false, checkedIn: false },
      { id: 'm9-5', name: '汪洋', phone: '131****9905', isCaptain: false, checkedIn: false },
      { id: 'm9-6', name: '石磊', phone: '131****9906', isCaptain: false, checkedIn: false },
      { id: 'm9-7', name: '田野', phone: '131****9907', isCaptain: false, checkedIn: false },
      { id: 'm9-8', name: '方圆', phone: '131****9908', isCaptain: false, checkedIn: false },
      { id: 'm9-9', name: '夏天', phone: '131****9909', isCaptain: false, checkedIn: false },
      { id: 'm9-10', name: '金秋', phone: '131****9910', isCaptain: false, checkedIn: false }
    ],
    timeline: [
      { at: '18:40', text: '预约成功', tone: 'success' },
      { at: '19:30', text: '街道通知 21:00 起在该场地举办社区文化活动，管理员正在核对封场范围', tone: 'warning' }
    ]
  },
  {
    id: 'B010',
    code: '117830',
    courtId: 'court-1',
    halves: ['H2'],
    scope: 'half',
    date: TODAY,
    start: '14:00',
    end: '16:00',
    actualStart: '14:05',
    actualEnd: '15:20',
    headcount: 4,
    acceptMerge: true,
    teamName: '午后散客场',
    captainId: 'u-zheng',
    captainName: '郑好',
    captainPhone: '130****1001',
    fixedTeam: false,
    credit: 99,
    status: 'earlyLeave',
    payStatus: 'refunded',
    checkInCode: '117830',
    lighting: { enabled: true, onAt: '14:30', offAt: '15:20', minutes: 50, fee: 40, deposit: 50 },
    fees: [
      { kind: 'lighting', label: '照明费 50 分钟 × 0.8 元（提前离场按实际时长）', amount: 40, ruleId: 'R-OT-1' },
      { kind: 'earlyRefund', label: '押金余额退回', amount: -10, ruleId: 'R-OT-1', note: '15:20 主动关灯离场，未用时段不收费' }
    ],
    members: [
      { id: 'm10-1', name: '郑好', phone: '130****1001', isCaptain: true, checkedIn: true, checkInAt: '14:05' },
      { id: 'm10-2', name: '王明', phone: '130****1002', isCaptain: false, checkedIn: true, checkInAt: '14:06' },
      { id: 'm10-3', name: '叶青', phone: '130****1003', isCaptain: false, checkedIn: true, checkInAt: '14:08' },
      { id: 'm10-4', name: '袁华', phone: '130****1004', isCaptain: false, checkedIn: true, checkInAt: '14:10' }
    ],
    timeline: [
      { at: '14:05', text: '签到 4/4', tone: 'success' },
      { at: '14:30', text: '阴天王动开灯', tone: 'info' },
      { at: '15:20', text: '队长点击"结束使用并关灯"，按实际 50 分钟结算', tone: 'success' },
      { at: '15:22', text: '押金 50 元扣除照明 40 元，退回 10 元（1–3 工作日到账）', tone: 'success' }
    ]
  },
  {
    id: 'B011',
    code: '552071',
    courtId: 'court-3',
    halves: ['H4'],
    scope: 'half',
    date: TODAY,
    start: '18:00',
    end: '20:00',
    headcount: 6,
    acceptMerge: true,
    teamName: '夜鹰队',
    captainId: 'u-gao',
    captainName: '高夜',
    captainPhone: '131****5566',
    fixedTeam: false,
    credit: 62,
    nightLock: 2,
    status: 'booked',
    payStatus: 'depositPaid',
    checkInCode: '552071',
    lockerNos: [9],
    lighting: { enabled: false, minutes: 0, fee: 0, deposit: 75 },
    fees: [],
    members: [
      { id: 'm11-1', name: '高夜', phone: '131****5566', isCaptain: true, checkedIn: false },
      { id: 'm11-2', name: '袁飞', phone: '131****5567', isCaptain: false, checkedIn: false },
      { id: 'm11-3', name: '宋岩', phone: '131****5568', isCaptain: false, checkedIn: false },
      { id: 'm11-4', name: '韩冰', phone: '131****5569', isCaptain: false, checkedIn: false },
      { id: 'm11-5', name: '曹阳', phone: '131****5570', isCaptain: false, checkedIn: false },
      { id: 'm11-6', name: '邓雷', phone: '131****5571', isCaptain: false, checkedIn: false }
    ],
    timeline: [
      { at: '09:40', text: '预约成功：因 90 天内 3 次噪声违规，30 天内仅可预约 20:00 前结束时段，本场 18:00–20:00（R-NIGHT-1）', tone: 'warning' },
      { at: '09:40', text: '夜间限制押金已支付 75 元（标准 50 元上浮 50%），正常关灯离场且无新投诉将全额退回（R-NIGHT-1）', tone: 'warning' },
      { at: '09:41', text: '已向全部队员公示统一结束时间 20:00（关灯离场），队长口头承诺不改变平台规则', tone: 'info' }
    ]
  },
  {
    id: 'B012',
    code: '552072',
    courtId: 'court-2',
    halves: ['H1'],
    scope: 'half',
    date: TODAY,
    start: '20:00',
    end: '22:00',
    headcount: 5,
    acceptMerge: true,
    teamName: '夜豹队',
    captainId: 'u-bao',
    captainName: '鲍越',
    captainPhone: '135****6677',
    fixedTeam: false,
    credit: 74,
    nightLock: 1,
    status: 'booked',
    payStatus: 'depositPaid',
    checkInCode: '552072',
    lighting: { enabled: false, minutes: 0, fee: 0, deposit: 75 },
    fees: [],
    members: [
      { id: 'm12-1', name: '鲍越', phone: '135****6677', isCaptain: true, checkedIn: false },
      { id: 'm12-2', name: '秦川', phone: '135****6678', isCaptain: false, checkedIn: false },
      { id: 'm12-3', name: '许冲', phone: '135****6679', isCaptain: false, checkedIn: false },
      { id: 'm12-4', name: '何峰', phone: '135****6680', isCaptain: false, checkedIn: false },
      { id: 'm12-5', name: '吕萌', phone: '135****6681', isCaptain: false, checkedIn: false }
    ],
    timeline: [
      { at: '10:02', text: '预约成功：90 天内 2 次噪声违规，30 天内夜间预约押金上浮 50%（R-NIGHT-1）', tone: 'warning' },
      { at: '10:02', text: '夜间限制押金已支付 75 元（半场标准 50 元 ×1.5），正常关灯离场无新投诉全额退回', tone: 'warning' },
      { at: '10:03', text: '已向队员公示统一结束时间 22:00（该场地静音截止 22:00，须关灯离场）', tone: 'info' }
    ]
  }
]

export const INCIDENTS: Incident[] = [
  {
    id: 'I-001',
    type: 'noise',
    courtId: 'court-1',
    bookingIds: ['B002'],
    title: '居民投诉夜间拍球噪声过大',
    desc: '望江新村 3 栋张阿姨来电：H2 队伍 18:00 起持续大声喧哗、砸篮筐，家中老人无法休息。此为今晚对 H2 的第 1 次投诉。',
    source: '望江新村 3 栋 张阿姨（139****6621）',
    time: '19:05',
    status: 'mediating',
    actions: [
      { at: '19:05', by: 'admin', text: '投诉登记工单 #N-20260927-03，通知社区工作人员到场' },
      { at: '19:12', by: 'worker', text: '林芳到场劝导，队长周浩承诺降低音量；现场噪声由 74dB 降至 61dB' }
    ],
    ruleApplied: ['R-NOISE-1', 'R-FAIR-3']
  },
  {
    id: 'I-002',
    type: 'hoopDispute',
    courtId: 'court-2',
    bookingIds: ['B005'],
    title: '两队争抢 H2 篮筐（已裁决）',
    desc: '17:40 维修前，夕阳队与未预约的现场队因 H2 篮筐使用权发生争执。',
    source: '现场上报',
    time: '17:40',
    status: 'resolved',
    actions: [
      { at: '17:40', by: 'worker', text: '林芳到场：夕阳队出示预约码 310964；现场队无预约记录' },
      { at: '17:43', by: 'admin', text: '老周依据 R-DISPUTE-1 裁定 H2 使用权归夕阳队；同时发现篮筐松动，两队均暂停使用' },
      { at: '17:45', by: 'admin', text: '为现场无预约队伍发放排队候补号，转至 B 区 H1 边线等候（当时湖畔队已在场），改约建议已推送' }
    ],
    ruleApplied: ['R-DISPUTE-1', 'R-FAIR-2']
  },
  {
    id: 'I-003',
    type: 'rain',
    courtId: 'court-1',
    bookingIds: ['B001', 'B002'],
    title: '阵雨地滑 · A区暂停使用后恢复',
    desc: '17:10 阵雨导致 A 区地面积水，管理员发布暂停使用通知；17:50 现场核验积水已清、地面仍湿滑，18:00 起恢复并提示谨慎运动。',
    source: '气象台预警 + 管理员巡检',
    time: '17:10',
    status: 'resolved',
    actions: [
      { at: '17:10', by: 'admin', text: '发布 A 区暂停使用通知（R-WX-1），未开场时段可免费改约/退款' },
      { at: '17:50', by: 'worker', text: '林芳现场拖拭积水并放置"地面湿滑"警示牌' },
      { at: '18:00', by: 'admin', text: '恢复使用，向在场两队推送安全提示；未开场前的等待不计入迟到免责已自动适用' }
    ],
    ruleApplied: ['R-WX-1']
  },
  {
    id: 'I-004',
    type: 'minorNight',
    courtId: 'court-1',
    bookingIds: ['B002'],
    title: '发现未成年人无监护人陪同夜场',
    desc: '巡查发现 H2 队员郑凯（16 岁）无监护人陪同参加夜间场次，已电话联系监护人，等待接回。',
    source: '社区工作人员夜场巡查',
    time: '19:28',
    status: 'mediating',
    actions: [
      { at: '19:28', by: 'worker', text: '林芳登记郑凯身份信息，现场告知夜场须监护人陪同（R-MINOR-1）' },
      { at: '19:31', by: 'worker', text: '已联系监护人郑先生（137****2203 本人机主为其母亲），预计 20:10 到场接回' }
    ],
    ruleApplied: ['R-MINOR-1']
  },
  {
    id: 'I-005',
    type: 'lightFault',
    courtId: 'court-2',
    bookingIds: ['B004'],
    title: 'B区 H1 照明灯故障，待现场核验',
    desc: '湖畔队 18:36 上报照明灯闪烁后熄灭，队长已停止使用照明。等待管理员现场核验并由队伍三选一无责方案。',
    source: '队长何莉 App 上报',
    time: '18:36',
    status: 'open',
    actions: [
      { at: '18:36', by: 'captain', text: '队长上报故障，费用计时已自动暂停' }
    ]
  },
  {
    id: 'I-006',
    type: 'seal',
    courtId: 'court-3',
    bookingIds: ['B009'],
    title: '街道社区文化活动拟 21:00 封场（H3/H4）',
    desc: '街道办通知：今晚 21:00–22:30 在河滨公园灯光球场 H3/H4 举办社区文化活动，需封场。星舰队 21:00–22:30 全场预约受影响，封场令待管理员签发。',
    source: '街道办事处活动通知',
    time: '19:30',
    status: 'open',
    actions: [
      { at: '19:30', by: 'worker', text: '林芳录入街道通知并通知管理员审核' }
    ]
  }
]

export const MERGE_REQUESTS: MergeRequest[] = [
  {
    id: 'MR-1',
    bookingId: 'B001',
    walkerName: '王同学',
    walkerPhone: '150****3321',
    people: 1,
    message: '一个人过来的，中投很稳，求拼到 20 点 🙏',
    status: 'pending',
    time: '19:31'
  },
  {
    id: 'MR-2',
    bookingId: 'B001',
    walkerName: '赵磊',
    walkerPhone: '139****7788',
    people: 1,
    message: '一个人，中投很稳',
    status: 'accepted',
    time: '18:15'
  },
  {
    id: 'MR-3',
    bookingId: 'B002',
    walkerName: '钱小多',
    walkerPhone: '150****8899',
    people: 2,
    message: '两个散客求拼',
    status: 'rejected',
    unreasonable: true,
    time: '17:52'
  }
]

/**
 * 噪声投诉记录（R-NOISE-1 / R-NIGHT-1）
 * 每行一次投诉：投诉时间、场地使用队伍、照明关闭时间、管理员现场提醒记在一起。
 * 按队长手机号归并同一球队，90 天窗口用于夜间限制判定。
 */
export const NOISE_RECORDS: NoiseRecord[] = [
  // ===== 散客联队（周浩 137****2201，A区 · 静音截止 21:00）=====
  {
    id: 'NR-001',
    time: '21:12', date: '2026-09-13', courtId: 'court-1',
    teamName: '散客联队', captainName: '周浩', teamKey: '137****2201',
    source: '望江新村 3 栋 张阿姨',
    desc: '过 21:00 静音截止后仍在大声扣篮、呐喊，家中老人无法入睡。',
    outcome: 'firstWarned',
    lightOffAt: '21:25',
    reminders: [
      { at: '21:12', by: 'worker', db: 73, verified: true, text: '林芳到场实测 73dB（限值 60dB），首次劝导，队长承诺 21:25 前关灯离场' },
      { at: '21:25', by: 'worker', db: 58, verified: true, text: '复查 58dB，队伍已关灯离场，登记照明关闭时间 21:25' }
    ]
  },
  {
    id: 'NR-002',
    time: '20:48', date: '2026-09-20', courtId: 'court-1',
    teamName: '散客联队', captainName: '周浩', teamKey: '137****2201',
    source: '望江新村 5 栋 多户联名',
    desc: '24 小时内第 2 次被投诉：砸篮板声响巨大，劝导后仍反复。',
    outcome: 'secondFined',
    lightOffAt: '21:02',
    reminders: [
      { at: '20:48', by: 'admin', db: 75, verified: true, text: '老周到场实测 75dB，口头警告并通知社区' },
      { at: '20:55', by: 'worker', db: 72, verified: true, text: '林芳第 2 次核实仍超标，收取社区安宁费 50 元、信用 -5，书面告知第 3 次暂停预约 30 天' },
      { at: '21:02', by: 'admin', db: 60, verified: true, text: '监督关灯离场，登记照明关闭时间 21:02' }
    ]
  },
  {
    id: 'NR-003',
    time: '19:05', date: TODAY, courtId: 'court-1', bookingId: 'B002', incidentId: 'I-001',
    teamName: '散客联队', captainName: '周浩', teamKey: '137****2201',
    source: '望江新村 3 栋 张阿姨（139****6621）',
    desc: 'H2 队伍 18:00 起持续大声喧哗、砸篮筐，此为今晚第 1 次投诉。',
    outcome: 'open',
    reminders: [
      { at: '19:12', by: 'worker', db: 74, verified: true, text: '林芳到场劝导，队长周浩承诺降低音量；现场噪声由 74dB 降至 61dB（待办结）' }
    ]
  },

  // ===== 夜鹰队（高夜 131****5566，河滨 · 静音截止 22:00）—— 已触发 level 2 时段限制 =====
  {
    id: 'NR-101',
    time: '22:08', date: '2026-08-22', courtId: 'court-3',
    teamName: '夜鹰队', captainName: '高夜', teamKey: '131****5566',
    source: '河滨公寓 2 号楼 刘先生',
    desc: '超过 22:00 静音截止仍在比赛呐喊。',
    outcome: 'firstWarned',
    lightOffAt: '22:20',
    reminders: [
      { at: '22:08', by: 'worker', db: 71, verified: true, text: '到场实测 71dB，首次劝导' },
      { at: '22:20', by: 'worker', db: 57, verified: true, text: '关灯离场，登记照明关闭时间 22:20' }
    ]
  },
  {
    id: 'NR-102',
    time: '22:15', date: '2026-09-05', courtId: 'court-3',
    teamName: '夜鹰队', captainName: '高夜', teamKey: '131****5566',
    source: '河滨公寓 2 号楼 3 户投诉',
    desc: '24 小时内第 2 次核实，比赛末段冲撞叫喊。',
    outcome: 'secondFined',
    lightOffAt: '22:26',
    reminders: [
      { at: '22:15', by: 'worker', db: 74, verified: true, text: '实测 74dB' },
      { at: '22:21', by: 'worker', db: 70, verified: true, text: '第 2 次核实超标，收社区安宁费 50 元、信用 -5' },
      { at: '22:26', by: 'admin', db: 59, verified: true, text: '监督关灯离场，登记照明关闭时间 22:26' }
    ]
  },
  {
    id: 'NR-103',
    time: '22:20', date: '2026-09-19', courtId: 'court-3',
    teamName: '夜鹰队', captainName: '高夜', teamKey: '131****5566',
    source: '河滨公寓物业 + 2 号楼住户',
    desc: '90 天内第 3 次核实违规，超时 20 分钟仍未关灯。',
    outcome: 'secondFined',
    lightOffAt: '22:31',
    reminders: [
      { at: '22:20', by: 'worker', db: 76, verified: true, text: '实测 76dB，第 3 次违规：收 50 元并触发 R-NIGHT-1 时段限制（30 天内仅可约 20:00 前结束时段、押金上浮 50%）' },
      { at: '22:31', by: 'admin', db: 58, verified: true, text: '强制关灯，登记照明关闭时间 22:31；限制决定已短信送达队长高夜' }
    ]
  },
  {
    id: 'NR-104',
    time: '21:42', date: '2026-09-25', courtId: 'court-3',
    teamName: '夜鹰队', captainName: '高夜', teamKey: '131****5566',
    source: '河滨公寓 2 号楼（电话反映）',
    desc: '限制生效后住户仍来电反映有运球声；队伍当晚预约为 18:00–20:00 时段。',
    outcome: 'unverified',
    lightOffAt: '19:58',
    reminders: [
      { at: '21:42', by: 'worker', db: 54, verified: false, text: '到场实测 54dB 未超标，场地已无人使用；查签到/照明记录，该队 19:58 已关灯离场，投诉不成立，回访居民说明' }
    ]
  },

  // ===== 夜豹队（鲍越 135****6677，B区 · 静音截止 22:00）—— 已触发 level 1 押金上浮 =====
  {
    id: 'NR-201',
    time: '21:40', date: '2026-09-06', courtId: 'court-2',
    teamName: '夜豹队', captainName: '鲍越', teamKey: '135****6677',
    source: '望江新村 5 栋 住户',
    desc: '夜间拍球声大、互相喊话。',
    outcome: 'firstWarned',
    lightOffAt: '22:05',
    reminders: [
      { at: '21:40', by: 'worker', db: 70, verified: true, text: '实测 70dB，首次劝导' },
      { at: '22:05', by: 'worker', db: 59, verified: true, text: '关灯离场，登记照明关闭时间 22:05' }
    ]
  },
  {
    id: 'NR-202',
    time: '21:55', date: '2026-09-22', courtId: 'court-2',
    teamName: '夜豹队', captainName: '鲍越', teamKey: '135****6677',
    source: '望江新村 5 栋 住户（24h 内第 2 次）',
    desc: '劝导后当晚再次被投诉核实。',
    outcome: 'secondFined',
    lightOffAt: '22:10',
    reminders: [
      { at: '21:55', by: 'worker', db: 72, verified: true, text: '第 2 次核实超标，收社区安宁费 50 元、信用 -5；触发 R-NIGHT-1 押金上浮 50%（30 天）' },
      { at: '22:10', by: 'admin', db: 60, verified: true, text: '监督关灯离场，登记照明关闭时间 22:10，押金规则已短信告知' }
    ]
  }
]
