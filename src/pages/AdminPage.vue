<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  NButton, NTag, NAlert, NGrid, NGridItem, NSelect, NInput, NInputNumber, NPopconfirm,
  NRadioGroup, NRadio, NForm, NFormItem, useMessage
} from 'naive-ui'
import {
  useState, nowStr, releaseBooking, endUsage, setSurface, adminReschedule
} from '../store'
import {
  STATUS_META, PAY_META, bookingRisk, checkedInCount, hm, isActive, money,
  feeSummary, timeState
} from '../lib/engine'
import type { Booking, SurfaceStatus } from '../types'
import RiskTag from '../components/RiskTag.vue'
import RuleLink from '../components/RuleLink.vue'
import BookingCard from '../components/BookingCard.vue'
import BottomSheet from '../components/BottomSheet.vue'
import { openIncidents } from '../lib/ui'

const state = useState()
const message = useMessage()

const courtFilter = ref<string>('all')

const timeSlots = ['14:00–16:00', '16:00–18:00', '18:00–20:00', '20:00–22:00', '21:00–22:30']
function inSlot(b: Booking, slot: string) {
  // 按开场时间归桶（全场跨时段时归到开场所在时段）
  const [s, e] = slot.split('–')
  return hm(b.start) >= hm(s) && hm(b.start) < hm(e)
}
const filtered = computed(() =>
  state.bookings
    .filter(b => courtFilter.value === 'all' || b.courtId === courtFilter.value)
    .filter(b => b.date === '2026-09-27')
    .sort((a, b) => hm(a.start) - hm(b.start) || a.halves.join().localeCompare(b.halves.join())))

function rowsOf(slot: string) {
  return filtered.value.filter(b => inSlot(b, slot))
}
function courtName(id: string) { return state.courts.find(c => c.id === id)!.name.replace('滨江社区篮球场 · ', '').replace('河滨公园灯光球场', '河滨') }

const totals = computed(() => {
  const act = state.bookings.filter(b => isActive(b, nowStr.value))
  return {
    booked: state.bookings.filter(b => ['booked', 'ongoing', 'late', 'overtime'].includes(b.status)).length,
    present: act.reduce((s, b) => s + checkedInCount(b), 0),
    unpaid: state.bookings.filter(b => b.payStatus === 'unpaid' || b.payStatus === 'deducted').length,
    high: state.bookings.filter(b => bookingRisk(b, state.incidents, nowStr.value).level === 'high').length,
    revenue: state.bookings.reduce((s, b) => {
      const court = state.courts.find(c => c.id === b.courtId)
      return s + feeSummary(b, court, nowStr.value).charges
    }, 0)
  }
})

// 场地控制
const surfaceTarget = ref<string>('')
const surfaceVal = ref<SurfaceStatus>('wet')
function applySurface() {
  if (!surfaceTarget.value) return
  const labels: Record<SurfaceStatus, string> = {
    good: '地面已恢复干燥，场地正常开放（R-WX-1）',
    wet: '阵雨过后地面湿滑，已放置警示牌，谨慎运动（R-WX-1）',
    slippery: '地面积水打滑，暂停使用，未开场可免费改约/退款（R-WX-1）',
    repair: '地面维修中，暂停使用（R-WX-2）'
  }
  setSurface(surfaceTarget.value, surfaceVal.value, labels[surfaceVal.value])
  message.success('场地状态已更新并通知相关队伍')
}
function toggleHoop(courtId: string, h: string) {
  const c = state.courts.find(x => x.id === courtId)!
  c.hoops[h] = c.hoops[h] === 'normal' ? 'maintaining' : 'normal'
  message.success(`${c.name} ${h} 篮筐状态已更新`)
}
function toggleLightFault(courtId: string) {
  const c = state.courts.find(x => x.id === courtId)!
  c.lighting.status = c.lighting.status === 'fault' ? 'ok' : 'fault'
  message.success(c.lighting.status === 'fault' ? '已标记照明故障' : '照明已恢复')
}

// 改约
const resTarget = ref<Booking | null>(null)
const resForm = ref({ start: '20:00', end: '22:00', reason: '街道社区活动占用', compensate: 5 })
function submitReschedule() {
  if (!resTarget.value) return
  adminReschedule(resTarget.value.id, resForm.value.start, resForm.value.end,
    resForm.value.reason, resForm.value.compensate)
  message.success('改约完成，已通知队长')
  resTarget.value = null
}

// 公平性配额（今日 18:00–21:00 黄金时段）
const fairness = computed(() => {
  const gold = state.bookings.filter(b => hm(b.start) >= 18 * 60 && hm(b.start) < 21 * 60 &&
    !['cancelled', 'noshow', 'rejected'].includes(b.status))
  const fixed = gold.filter(b => b.fixedTeam).length
  const total = gold.length
  const halfCapacity = state.courts.reduce((s, c) => s + c.halfCourts * 2, 0) // 两个黄金时段
  const fixedSlots = state.bookings.filter(b => b.fixedTeam && hm(b.start) >= 18 * 60 && hm(b.start) < 21 * 60)
    .reduce((s, b) => s + b.halves.length, 0)
  const allSlots = state.courts.reduce((s, c) => s + c.halfCourts, 0) * 2
  return { fixed, total, fixedPct: total ? Math.round(fixed / total * 100) : 0, fixedSlots, allSlots, slotPct: Math.round(fixedSlots / allSlots * 100), halfCapacity }
})
</script>

<template>
  <div class="page" v-if="state.role === 'admin'">
    <!-- 总览指标 -->
    <NGrid :cols="3" :x-gap="6" style="margin-bottom:10px">
      <NGridItem><div class="kpi"><div class="kpi-n">{{ totals.booked }}</div><div class="kpi-l">今日预约/在场</div></div></NGridItem>
      <NGridItem><div class="kpi"><div class="kpi-n">{{ totals.present }}</div><div class="kpi-l">实际到场</div></div></NGridItem>
      <NGridItem><div class="kpi"><div class="kpi-n" :style="{ color: totals.high ? '#d03050' : undefined }">{{ totals.high }}</div><div class="kpi-l">高风险场次</div></div></NGridItem>
      <NGridItem><div class="kpi"><div class="kpi-n">{{ totals.unpaid }}</div><div class="kpi-l">未付/待补缴</div></div></NGridItem>
      <NGridItem><div class="kpi"><div class="kpi-n">¥{{ money(totals.revenue) }}</div><div class="kpi-l">照明费累计</div></div></NGridItem>
      <NGridItem><div class="kpi"><div class="kpi-n" style="color:#2080f0">{{ state.courts.reduce((s,c)=>s+c.lockersFree,0) }}</div><div class="kpi-l">空余更衣柜</div></div></NGridItem>
    </NGrid>

    <div class="filter-bar">
      <NSelect v-model:value="courtFilter" size="small" style="width:170px"
        :options="[{ label: '全部场地', value: 'all' }, ...state.courts.map(c => ({ label: c.name, value: c.id }))]" />
      <NButton size="small" type="primary" ghost round @click="openIncidents()">
        事件处置（{{ state.incidents.filter(i => i.status !== 'resolved' && i.status !== 'penalized').length }}）
      </NButton>
      <NButton size="small" type="warning" ghost round @click="openIncidents('noise')">🌙 夜间限制效果</NButton>
    </div>

    <!-- 分时段预约表 -->
    <div v-for="slot in timeSlots" :key="slot" class="slot-block">
      <div class="slot-title">🕐 {{ slot }} 时段</div>
      <div v-if="rowsOf(slot).length === 0" class="slot-empty">暂无预约</div>
      <div v-for="b in rowsOf(slot)" :key="b.id" class="admin-row">
        <div class="ar-top">
          <span class="ar-team">{{ b.teamName }}</span>
          <RiskTag :level="bookingRisk(b, state.incidents, nowStr).level"
            :reasons="bookingRisk(b, state.incidents, nowStr).reasons" />
        </div>
        <div class="ar-meta">
          {{ courtName(b.courtId) }} · {{ b.scope === 'full' ? '全场' : '半场' }} {{ b.halves.join('+') }} ·
          签到码 <b>{{ b.checkInCode }}</b>
        </div>
        <div class="ar-chips">
          <NTag size="tiny" :type="STATUS_META[b.status].type">{{ STATUS_META[b.status].label }}</NTag>
          <NTag size="tiny">预约 {{ b.headcount }} 人</NTag>
          <NTag size="tiny" :type="checkedInCount(b) === 0 ? 'warning' : 'success'">到场 {{ checkedInCount(b) }}/{{ b.members.length }}</NTag>
          <NTag size="tiny" :type="PAY_META[b.payStatus].type">{{ PAY_META[b.payStatus].label }}</NTag>
          <NTag size="tiny">信用 {{ b.credit }}</NTag>
          <NTag v-if="b.fixedTeam" size="tiny" type="info">固定球队</NTag>
          <NTag v-if="b.nightLock === 2" size="tiny" type="error">🌙 限20:00前·押金75</NTag>
          <NTag v-else-if="b.nightLock === 1" size="tiny" type="warning">🌙 押金上浮50%</NTag>
        </div>
        <div v-if="isActive(b, nowStr)" class="ar-live">
          照明已用 {{ feeSummary(b, state.courts.find(c => c.id === b.courtId), nowStr).light?.minutes ?? 0 }} 分钟 ·
          当前费用 ¥{{ money(feeSummary(b, state.courts.find(c => c.id === b.courtId), nowStr).charges) }} ·
          押金 ¥{{ b.lighting.deposit }}
          <template v-if="timeState(b, nowStr).overtimeMinutes > 0">
            · <span style="color:#d03050">超时 {{ timeState(b, nowStr).overtimeMinutes }} 分钟</span>
          </template>
        </div>
        <div class="ar-actions">
          <NButton v-if="b.status === 'booked' && timeState(b, nowStr).releasable" size="tiny" type="error" ghost round
            @click="releaseBooking(b.id)">释放（爽约处理）</NButton>
          <NPopconfirm v-if="isActive(b, nowStr)" @positive-click="endUsage(b.id, true)">
            <template #trigger><NButton size="tiny" type="error" ghost round>强制结束并结算</NButton></template>
            将按实际时长结算照明费并关灯
          </NPopconfirm>
          <NButton v-if="['booked', 'ongoing'].includes(b.status)" size="tiny" round
            @click="resTarget = b">管理员改约</NButton>
        </div>
      </div>
    </div>

    <!-- 公平性配额 -->
    <div class="fair-box">
      <div class="fb-title">⚖️ 公共资源公平性（今日黄金时段 18:00–21:00）</div>
      <div class="fb-row">固定球队预约占比：<b>{{ fairness.fixed }}/{{ fairness.total }} 场（{{ fairness.fixedPct }}%）</b>，规则上限 60% <RuleLink id="R-FAIR-1" /></div>
      <div class="fb-bar">
        <div class="fb-fill fixed" :style="{ width: fairness.fixedPct + '%' }">固定 {{ fairness.fixedPct }}%</div>
        <div class="fb-fill public" :style="{ width: (100 - fairness.fixedPct) + '%' }">散客/临时 {{ 100 - fairness.fixedPct }}%</div>
      </div>
      <div class="fb-row" style="margin-top:6px">半场名额占用：固定队 {{ fairness.fixedSlots }} / {{ fairness.allSlots }} 个半场时段；其余名额开场前 24 小时向全体市民开放。</div>
      <div class="fb-row">冲突排序：<b>场地安全/维修 &gt; 已支付已签到 &gt; 固定队固定时段 &gt; 先到先得 &gt; 信用分</b> <RuleLink id="R-FAIR-4" /></div>
      <div class="fb-row">现场释放：开场 20 分钟未签到即释放给候补散客，防止公共资源空置 <RuleLink id="R-FAIR-2" /></div>
    </div>

    <!-- 场地控制 -->
    <div class="venue-box">
      <div class="fb-title">🎛️ 场地状态控制（现场核验后发布）</div>
      <div v-for="c in state.courts" :key="c.id" class="vc-court">
        <div class="vc-name">{{ c.name }}</div>
        <div class="vc-row">
          <span style="font-size:12px;color:#666">地面：</span>
          <NRadioGroup v-model:value="surfaceVal" size="small">
            <NRadio value="good">干燥良好</NRadio>
            <NRadio value="wet">湿滑</NRadio>
            <NRadio value="slippery">积水暂停</NRadio>
            <NRadio value="repair">维修中</NRadio>
          </NRadioGroup>
          <NButton size="tiny" type="primary" round style="margin-left:auto"
            @click="surfaceTarget = c.id; applySurface()">发布</NButton>
        </div>
        <div class="vc-row">
          <span style="font-size:12px;color:#666">篮筐：</span>
          <NButton v-for="h in Object.keys(c.hoops)" :key="h" size="tiny" round
            :type="c.hoops[h] === 'normal' ? 'success' : 'warning'"
            @click="toggleHoop(c.id, h)">
            {{ h }} {{ c.hoops[h] === 'normal' ? '正常' : '维修中' }}
          </NButton>
          <NButton size="tiny" round :type="c.lighting.status === 'fault' ? 'error' : 'default'"
            @click="toggleLightFault(c.id)">
            照明{{ c.lighting.status === 'fault' ? '故障（点按恢复）' : '正常（点按报故障）' }}
          </NButton>
        </div>
      </div>
    </div>

    <!-- 改约抽屉 -->
    <BottomSheet :show="!!resTarget" title="管理员改约" @update:show="v => !v && (resTarget = null)">
      <NForm v-if="resTarget" label-placement="top" size="small">
        <NAlert type="warning" style="margin-bottom:8px">
          改约队伍：{{ resTarget.teamName }}（{{ resTarget.start }}–{{ resTarget.end }}）。改约必须给出理由与补偿，规则编号将展示给队长。<RuleLink id="R-FAIR-4" />
        </NAlert>
        <div style="font-size:12px;color:#999;margin-bottom:6px">为什么改约：系统按"安全维修 &gt; 已支付已签到 &gt; 固定队 &gt; 先到先得 &gt; 信用分"排序，被改约方一定收到明确解释。</div>
        <NFormItem label="新时段（HH:mm）">
          <NInput v-model:value="resForm.start" style="width:90px" placeholder="20:00" /> -
          <NInput v-model:value="resForm.end" style="width:90px;margin-left:6px" placeholder="22:00" />
        </NFormItem>
        <NFormItem label="改约理由">
          <NInput v-model:value="resForm.reason" type="textarea" :rows="2" />
        </NFormItem>
        <NFormItem label="补偿金额（元，原路退回）">
          <NInputNumber v-model:value="resForm.compensate" :min="0" style="width:100%" />
        </NFormItem>
        <NButton type="primary" block round @click="submitReschedule">确认改约并通知队长</NButton>
      </NForm>
    </BottomSheet>
  </div>

  <!-- 社区工作人员：引导到事件页 -->
  <div v-else-if="state.role === 'worker'" class="page">
    <NAlert type="info" title="社区工作人员入口">
      你的主要工作是<b>噪声劝导、未成年人夜场巡查与争议调解</b>，请在「事件」标签页处理工单；「看板」可查看现场实时使用情况。
    </NAlert>
    <NButton type="primary" block round style="margin-top:12px" @click="openIncidents()">前往事件处置</NButton>
  </div>

  <!-- 其他角色 -->
  <div v-else class="page">
    <NAlert type="warning" title="需要管理员权限">
      后台仅对场地管理员开放。你可以在顶部切换身份体验"老周（管理员）"或"林芳（社区工作人员）"视角。
    </NAlert>
  </div>
</template>

<style scoped>
.kpi { background:#fff; border-radius:10px; text-align:center; padding:10px 4px; }
.kpi-n { font-size:18px; font-weight:800; }
.kpi-l { font-size:11px; color:#909399; }
.filter-bar { display:flex; gap:8px; align-items:center; margin-bottom:10px; }
.slot-block { margin-bottom:14px; }
.slot-title { font-weight:700; font-size:13px; color:#444; margin-bottom:6px; }
.slot-empty { font-size:12px; color:#aaa; padding:4px 2px; }
.admin-row { background:#fff; border-radius:10px; padding:10px; margin-bottom:8px; box-shadow:0 1px 3px rgba(0,0,0,.05); }
.ar-top { display:flex; justify-content:space-between; align-items:center; }
.ar-team { font-weight:700; font-size:14px; }
.ar-meta { font-size:12px; color:#888; margin:3px 0; }
.ar-chips { display:flex; gap:4px; flex-wrap:wrap; margin:4px 0; }
.ar-live { font-size:12px; color:#666; background:#f7f9fc; border-radius:6px; padding:5px 7px; margin-top:4px; }
.ar-actions { display:flex; gap:6px; margin-top:6px; flex-wrap:wrap; }
.fair-box { background:linear-gradient(135deg,#f0f7ff,#f7f0ff); border-radius:12px; padding:12px; margin-bottom:12px; font-size:12px; line-height:1.9; }
.fb-title { font-weight:700; font-size:13px; margin-bottom:6px; }
.fb-bar { display:flex; height:22px; border-radius:6px; overflow:hidden; margin:6px 0; font-size:11px; color:#fff; text-align:center; line-height:22px; }
.fb-fill.fixed { background:#2080f0; }
.fb-fill.public { background:#18a058; }
.venue-box { background:#fff; border-radius:12px; padding:12px; }
.vc-court { border-top:1px dashed #eee; padding:10px 0; }
.vc-court:first-of-type { border-top:none; }
.vc-name { font-weight:700; font-size:13px; margin-bottom:6px; }
.vc-row { display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin:6px 0; }
</style>
