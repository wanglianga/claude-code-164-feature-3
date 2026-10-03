<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  NButton, NCheckbox, NForm, NFormItem, NInput, NInputNumber,
  NRadio, NRadioGroup, NSelect, NTag, NGrid, NGridItem, NAlert,
  useMessage
} from 'naive-ui'
import { useState, createBooking, reportIncident, nowStr } from '../store'
import {
  SURFACE_META, HOOP_META, courtRisk, bookingsOfHalf, halfSealed, isActive,
  slotOptions, money, hm, timeState, restrictionOf, nightDeposit,
  slotBlockedByNight, platformEndTime
} from '../lib/engine'
import type { SlotOption } from '../lib/engine'
import type { Booking, Court } from '../types'
import RiskTag from '../components/RiskTag.vue'
import RuleLink from '../components/RuleLink.vue'
import BottomSheet from '../components/BottomSheet.vue'
import { activeTab } from '../lib/ui'

const state = useState()
const message = useMessage()

const selectedCourt = ref<Court | null>(null)
const showBooking = ref(false)
const showReport = ref(false)
const showOccupancy = ref<Court | null>(null)

function openBooking(c: Court) {
  selectedCourt.value = c
  form.value = {
    courtId: c.id,
    scope: 'half',
    half: Object.keys(c.hoops).find(h => c.hoops[h] === 'normal' && c.surface === 'good') ?? Object.keys(c.hoops)[0],
    slot: '',
    headcount: c.halfCourts > 1 ? 6 : 4,
    acceptMerge: true,
    needLight: true,
    teamName: '',
    captainName: state.role === 'captain' ? '陈晨' : '',
    captainPhone: state.role === 'captain' ? '138****0001' : ''
  }
  showBooking.value = true
}

const form = ref({
  courtId: '',
  scope: 'half' as 'half' | 'full',
  half: '',
  slot: '',
  headcount: 6,
  acceptMerge: true,
  needLight: true,
  teamName: '',
  captainName: '',
  captainPhone: ''
})

const slots = computed(() => selectedCourt.value ? slotOptions(selectedCourt.value, state.bookings) : [])
const chosenSlot = computed(() => slots.value.find(s => s.label === form.value.slot))

/** 预约人当前夜间限制画像（按队长手机号/姓名实时匹配） */
const formRestriction = computed(() => {
  if (!selectedCourt.value) return null
  return restrictionOf(
    { captainPhone: form.value.captainPhone || '未填写', captainName: form.value.captainName },
    state.noiseRecords)
})

function slotDisabled(s: SlotOption | undefined): boolean {
  if (!s) return true
  if (form.value.scope === 'full') return !s.fullAvailable
  if (s.freeHalves.length === 0) return true
  if (formRestriction.value && slotBlockedByNight(s.end, formRestriction.value)) return true
  return false
}

function halfOptions(c: Court | null) {
  if (!c) return []
  return Object.keys(c.hoops).map(h => {
    const disabledInSlot = chosenSlot.value ? !chosenSlot.value.freeHalves.includes(h) : false
    return { label: `${h}（${HOOP_META[c.hoops[h]].label}${disabledInSlot ? ' · 该时段已约' : ''}）`, value: h, disabled: disabledInSlot || c.hoops[h] !== 'normal' }
  })
}

const headHint = computed(() => {
  const full = form.value.scope === 'full'
  const n = form.value.headcount
  if (n < (full ? 8 : 4)) return { type: 'warning' as const, text: `人数低于建议下限（${full ? '全场 8' : '半场 4'} 人），建议勾选接受拼场（R-BOOK-1）` }
  if (n > (full ? 14 : 8)) return { type: 'error' as const, text: `超出建议人数上限（${full ? '全场 14' : '半场 8'} 人）` }
  return { type: 'success' as const, text: '人数符合建议区间' }
})

const feePreview = computed(() => {
  const c = selectedCourt.value
  if (!c || !form.value.slot) return null
  const slot = chosenSlot.value!
  if (!slot.night || !form.value.needLight) {
    return { deposit: 0, rate: 0, perMin: 0, note: '该时段为白天，无需照明；场地本身免费开放' }
  }
  const halfFactor = form.value.scope === 'full' ? 2 : 1
  const baseDeposit = form.value.scope === 'full' ? 100 : c.lighting.deposit
  const deposit = nightDeposit(baseDeposit, formRestriction.value?.level ?? 0)
  const perMin = c.lighting.pricePerMinute * halfFactor * (form.value.acceptMerge ? 0.8 : 1)
  const mins = (hm(slot.end) - hm(slot.start))
  return {
    deposit,
    baseDeposit,
    nightLevel: formRestriction.value?.level ?? 0,
    rate: perMin,
    perMin,
    max: perMin * mins,
    fault: c.lighting.status === 'fault',
    note: c.lighting.status === 'fault'
      ? '该片场地照明当前故障，夜间场次暂无法开灯；提交预约后若到场仍未修复，可按 R-LIGHT-3 免费改约或全额退款'
      : `夜间按实际开灯分钟计费，预估上限 ¥${money(perMin * mins)}（${form.value.acceptMerge ? '拼场 8 折，' : ''}结束按实际时长结算），押金 ¥${deposit}`
  }
})

/** 选中时段的平台统一结束（关灯离场）时间 */
const platformEnd = computed(() => {
  const c = selectedCourt.value
  const s = chosenSlot.value
  if (!c || !s) return ''
  return platformEndTime({ start: s.start, end: s.end }, c)
})

function submit() {
  const c = selectedCourt.value!
  const slot = chosenSlot.value!
  if (!slot) return message.warning('请选择时间段')
  if (formRestriction.value && slotBlockedByNight(slot.end, formRestriction.value)) {
    return message.warning('你所在球队处于 level 2 夜间限制：30 天内仅可预约 20:00 前结束的时段（R-NIGHT-1）')
  }
  let halves: string[]
  if (form.value.scope === 'full') {
    if (!slot.fullAvailable) return message.warning('该时段没有两个相邻空闲半场，无法约全场')
    halves = slot.freeHalves.slice(0, 2)
  } else {
    if (!slot.freeHalves.includes(form.value.half)) return message.warning('该半场该时段已被预约，请选择其他半场或时段')
    halves = [form.value.half]
  }
  const b = createBooking({
    courtId: c.id,
    halves,
    scope: form.value.scope,
    start: slot.start,
    end: slot.end,
    headcount: form.value.headcount,
    acceptMerge: form.value.acceptMerge,
    needLight: form.value.needLight,
    teamName: form.value.teamName,
    captainName: form.value.captainName,
    captainPhone: form.value.captainPhone
  })
  showBooking.value = false
  message.success(`预约成功！签到码 ${b.code}，已为你跳转"我的"`)
  activeTab.value = 'mine'
}

// 事件上报
const reportForm = ref({ courtId: '', type: 'rain' as any, desc: '', name: '' })
function openReport(c: Court) {
  reportForm.value = { courtId: c.id, type: 'rain', desc: '', name: '' }
  showReport.value = true
}
function submitReport() {
  const c = state.courts.find(x => x.id === reportForm.value.courtId)!
  const titles: Record<string, string> = {
    rain: '市民上报下雨地滑',
    lightFault: '市民上报照明异常',
    hoopDispute: '现场发生篮筐使用权争执',
    noise: '居民反映噪声扰民'
  }
  reportIncident(reportForm.value.type, c.id, [], titles[reportForm.value.type] ?? '市民上报',
    reportForm.value.desc || '市民现场上报，请尽快核验', reportForm.value.name || '匿名市民')
  showReport.value = false
  message.success('已上报，管理员/社区工作人员将在 10 分钟内到场核验')
}

function halfCurrent(c: Court, h: string): Booking | undefined {
  return bookingsOfHalf(c, h, state.bookings).find(b => isActive(b, nowStr.value))
}
function remainChip(c: Court, h: string): string {
  const b = halfCurrent(c, h)
  if (!b) return ''
  const t = timeState(b, nowStr.value)
  if (t.overtimeMinutes > 0) return `超时 ${t.overtimeMinutes} 分钟`
  return `还能打 ${Math.floor(t.remaining / 60)}时${t.remaining % 60}分`
}
function occupancyBlocks(c: Court, h: string) {
  return bookingsOfHalf(c, h, state.bookings).filter(b => b.date === '2026-09-27')
}
</script>

<template>
  <div class="page">
    <NAlert type="info" :show-icon="false" style="margin-bottom:10px;border-radius:10px">
      <div style="font-size:12px;line-height:1.7">
        公共球场<b>免费开放</b>，仅夜间使用照明时按实际时长计费。场地优先保障周边居民，预约/改约规则均可点击编号查看原文。
      </div>
    </NAlert>

    <div v-for="c in state.courts" :key="c.id" class="court-card">
      <div class="court-head">
        <div>
          <div class="court-name">{{ c.name }}</div>
          <div class="court-sub">{{ c.park }} · 距你 {{ c.distanceM }}m · {{ c.halfCourts }} 个半场</div>
        </div>
        <RiskTag :level="courtRisk(c, state.bookings, state.incidents, nowStr).level"
          :reasons="courtRisk(c, state.bookings, state.incidents, nowStr).reasons" />
      </div>

      <div v-if="c.sealed" class="seal-banner">
        🚧 已封场：{{ c.sealReason }}（R-SEAL-1）
      </div>

      <div class="court-tags">
        <NTag :type="SURFACE_META[c.surface].type" size="small" round>🛝 {{ SURFACE_META[c.surface].label }}</NTag>
        <NTag v-for="(s, h) in c.hoops" :key="h" :type="HOOP_META[s].type" size="small" round>
          {{ h }} 篮筐：{{ HOOP_META[s].label }}
        </NTag>
      </div>

      <div class="court-info">
        <div class="ci-row">🏘️ 噪声敏感：<b>{{ c.noiseSensitive.join('；') }}</b>，静音截止 {{ c.noiseCurfew }}:00 <RuleLink id="R-NOISE-1" /></div>
        <div class="ci-row">🗄️ 更衣柜：可用 {{ c.lockersFree }}/{{ c.lockersTotal }} 个（签到后自动分配）</div>
        <div class="ci-row">
          💡 夜间照明：
          <template v-if="!c.lighting.available"><NTag size="tiny">不可用</NTag></template>
          <template v-else-if="c.lighting.status === 'fault'"><NTag size="tiny" type="error">故障</NTag></template>
          <template v-else><NTag size="tiny" type="success">正常</NTag></template>
          <b style="margin-left:4px">¥{{ c.lighting.pricePerMinute }}/分钟·半场</b>，{{ c.lighting.autoOnHour }}:00 起可开灯，押金 ¥{{ c.lighting.deposit }}
          <RuleLink id="R-LIGHT-1" />
        </div>
      </div>

      <!-- 当前各半场使用情况 -->
      <div class="halves-now">
        <div v-for="h in Object.keys(c.hoops)" :key="h" class="half-chip"
          :class="{ active: halfCurrent(c, h), disabled: halfSealed(c, h) || c.hoops[h] !== 'normal' }">
          <div class="hc-name">{{ h }}</div>
          <div v-if="halfSealed(c, h)" class="hc-state">封停中</div>
          <div v-else-if="c.hoops[h] !== 'normal'" class="hc-state">不可用</div>
          <div v-else-if="halfCurrent(c, h)" class="hc-state">
            ✅ {{ halfCurrent(c, h)!.teamName }}
            <div style="font-size:11px;color:#18a058">{{ remainChip(c, h) }}</div>
          </div>
          <div v-else class="hc-state idle">空闲可排队</div>
        </div>
      </div>

      <div class="court-actions">
        <NButton type="primary" size="small" round :disabled="c.sealed" @click="openBooking(c)">📅 预约这片场地</NButton>
        <NButton size="small" round @click="showOccupancy = c">📊 今日占用</NButton>
        <NButton size="small" round quaternary type="warning" @click="openReport(c)">⚠ 现场上报</NButton>
      </div>
    </div>

    <!-- 预约弹窗（移动端底部抽屉） -->
    <BottomSheet v-model:show="showBooking" title="填写预约信息">
      <NForm v-if="selectedCourt" label-placement="top" size="small">
        <NFormItem label="预约范围">
          <NRadioGroup v-model:value="form.scope">
            <NRadio value="half">半场（4–8 人）</NRadio>
            <NRadio value="full" :disabled="selectedCourt.halfCourts < 2">全场（8–14 人，占两个半场）</NRadio>
          </NRadioGroup>
        </NFormItem>

        <NFormItem v-if="form.scope === 'half'" label="选择半场">
          <NRadioGroup v-model:value="form.half">
            <NRadio v-for="opt in halfOptions(selectedCourt)" :key="opt.value" :value="opt.value" :disabled="opt.disabled">
              {{ opt.label }}
            </NRadio>
          </NRadioGroup>
        </NFormItem>
        <NFormItem v-else label="全场半场">
          <span style="font-size:12px;color:#666">提交时自动匹配同一时段两个空闲半场（H1+H2…）</span>
        </NFormItem>

        <NFormItem label="时间段（今日 9/27）">
          <NSelect v-model:value="form.slot" placeholder="选择 2 小时时段"
            :options="slots.map(s => {
              const nightBlocked = !!formRestriction && slotBlockedByNight(s.end, formRestriction)
              const cap = nightBlocked
                ? '（夜间限制：仅可约 20:00 前结束）'
                : form.scope === 'full' ? (s.fullAvailable ? '（全场可约）' : '（全场不足）')
                  : (s.freeHalves.length ? `（余 ${s.freeHalves.length} 个半场）` : '（已满）')
              return {
                label: s.label + (s.night ? '🌙' : '☀️') + cap,
                value: s.label,
                disabled: slotDisabled(s)
              }
            })" />
        </NFormItem>

        <!-- 预约前：历史违规原因 + 本次押金规则（队长确认，减少口头承诺与平台规则不一致） -->
        <NAlert v-if="formRestriction && formRestriction.level >= 1" type="error" style="margin:0 0 8px">
          <div style="font-size:12px;line-height:1.7">
            <div>🌙 <b>夜间限制 L{{ formRestriction.level }} 生效中</b>（R-NIGHT-1）：{{ form.captainName || '该实名' }} 所在球队近 90 天有
              <b>{{ formRestriction.violations }} 次经现场核实的噪声违规</b>。</div>
            <div style="white-space:pre-line;margin-top:3px;color:#7a2b1d">{{ formRestriction.reason }}</div>
            <div style="margin-top:3px">本次押金规则：<b>标准 ¥{{ feePreview?.baseDeposit }} → 收取 ¥{{ feePreview?.deposit }}（上浮 50%）</b>，
              正常关灯离场且无新核实投诉将全额退回。<template v-if="formRestriction.level >= 2">20:00 后结束的时段<b>已禁止预约</b>。</template></div>
          </div>
        </NAlert>

        <NGrid :cols="2" :x-gap="8">
          <NGridItem>
            <NFormItem label="人数">
              <NInputNumber v-model:value="form.headcount" :min="1" :max="20" style="width:100%" />
            </NFormItem>
          </NGridItem>
          <NGridItem>
            <NFormItem label="队伍名称（选填）">
              <NInput v-model:value="form.teamName" placeholder="如：晨光队" />
            </NFormItem>
          </NGridItem>
        </NGrid>
        <NAlert :type="headHint.type" style="margin:2px 0 8px">{{ headHint.text }}</NAlert>

        <NFormItem label="队长信息">
          <NGrid :cols="2" :x-gap="8" style="width:100%">
            <NGridItem><NInput v-model:value="form.captainName" placeholder="姓名" /></NGridItem>
            <NGridItem><NInput v-model:value="form.captainPhone" placeholder="手机号" /></NGridItem>
          </NGrid>
        </NFormItem>

        <div class="opt-box">
          <NCheckbox v-model:checked="form.acceptMerge">
            <b>接受散客拼场</b>（黄金时段优先排位 + 照明费 8 折，费用按签到人数平摊）<RuleLink id="R-BOOK-2" />
          </NCheckbox>
        </div>
        <div class="opt-box">
          <NCheckbox v-model:checked="form.needLight" :disabled="chosenSlot && !chosenSlot.night">
            <b>需要夜间照明</b>（18:00 后场次，开灯前付押金，按实际使用分钟计费）<RuleLink id="R-LIGHT-2" />
          </NCheckbox>
        </div>

        <NAlert v-if="feePreview" :type="feePreview.fault ? 'error' : 'info'" style="margin-top:8px">
          <div style="font-size:12px;line-height:1.7">
            <div>💰 {{ feePreview.note }}</div>
            <div v-if="feePreview.deposit > 0">
              单价 ¥{{ money(feePreview.perMin) }}/分钟{{ form.acceptMerge ? '（已含 8 折）' : '' }}，拼场人均更低
              <template v-if="(feePreview?.nightLevel ?? 0) >= 1">；<b style="color:#cf4328">夜间限制押金 ¥{{ feePreview?.deposit }}（标准 ¥{{ feePreview?.baseDeposit }}，上浮 50%）</b></template>
            </div>
            <div v-if="platformEnd">⏰ 统一结束（关灯离场）时间 <b>{{ platformEnd }}</b>：提交后向全体队员公示，队员可见同一结束时间，队长口头承诺不改变平台规则 <RuleLink id="R-NIGHT-1" /></div>
            <div>开场 15 分钟内签到免责；提前关灯即停止计费 <RuleLink id="R-LATE-1" /> <RuleLink id="R-OT-1" /></div>
          </div>
        </NAlert>

        <NButton type="primary" block round style="margin-top:12px" @click="submit">确认预约</NButton>
      </NForm>
    </BottomSheet>

    <!-- 今日占用弹窗 -->
    <BottomSheet :show="!!showOccupancy" :title="showOccupancy?.name ?? ''"
      @update:show="v => !v && (showOccupancy = null)">
      <div v-if="showOccupancy" style="font-size:12px">
        <div style="color:#999;margin-bottom:6px">今日各半场预约（06:00–22:00）</div>
        <div v-for="h in Object.keys(showOccupancy.hoops)" :key="h" style="margin-bottom:12px">
          <div style="font-weight:700;margin-bottom:4px">{{ h }}（篮筐{{ HOOP_META[showOccupancy.hoops[h]].label }}）</div>
          <div v-if="occupancyBlocks(showOccupancy, h).length === 0" style="color:#999">今日暂无预约</div>
          <div v-for="b in occupancyBlocks(showOccupancy, h)" :key="b.id" class="occ-row">
            <span class="occ-time">{{ b.start }}–{{ b.end }}</span>
            <span style="flex:1">{{ b.teamName }}</span>
            <NTag size="tiny"
              :type="isActive(b, nowStr) ? 'success' : b.status === 'noshow' ? 'error' : (b.status === 'rescheduled' || b.status === 'sealed') ? 'warning' : 'default'">
              {{ isActive(b, nowStr) ? '使用中' : b.status === 'noshow' ? '爽约释放' : b.status === 'rescheduled' ? '已改约' : b.status === 'sealed' ? '封场退款' : '已预约' }}
            </NTag>
          </div>
        </div>
      </div>
    </BottomSheet>

    <!-- 现场上报弹窗 -->
    <BottomSheet v-model:show="showReport" title="现场情况上报">
      <NForm label-placement="top" size="small">
        <NFormItem label="上报场地">
          <NSelect v-model:value="reportForm.courtId"
            :options="state.courts.map(c => ({ label: c.name, value: c.id }))" />
        </NFormItem>
        <NFormItem label="情况类型">
          <NSelect v-model:value="reportForm.type" :options="[
            { label: '🌧️ 下雨地滑 / 地面积水', value: 'rain' },
            { label: '💡 照明故障 / 闪烁', value: 'lightFault' },
            { label: '🥊 两队争抢篮筐', value: 'hoopDispute' },
            { label: '🔊 噪声扰民（居民投诉）', value: 'noise' }
          ]" />
        </NFormItem>
        <NFormItem label="具体描述">
          <NInput v-model:value="reportForm.desc" type="textarea" placeholder="请描述现场情况，便于工作人员携带设备到场" :rows="3" />
        </NFormItem>
        <NFormItem label="您的称呼（选填）">
          <NInput v-model:value="reportForm.name" placeholder="匿名也可上报" />
        </NFormItem>
        <NButton type="primary" block round @click="submitReport">提交上报</NButton>
      </NForm>
    </BottomSheet>
  </div>
</template>

<style scoped>
.court-card { background:#fff; border-radius:12px; padding:12px; margin-bottom:10px; box-shadow:0 1px 4px rgba(0,0,0,.06); }
.court-head { display:flex; justify-content:space-between; align-items:flex-start; gap:8px; }
.court-name { font-weight:800; font-size:15px; }
.court-sub { font-size:11.5px; color:#909399; margin-top:2px; }
.seal-banner { background:#fff1f0; color:#cf1322; border-radius:8px; padding:7px 9px; font-size:12.5px; margin:8px 0; font-weight:600; }
.court-tags { display:flex; gap:6px; flex-wrap:wrap; margin:8px 0; }
.court-info { background:#f7f9fc; border-radius:10px; padding:8px 10px; font-size:12px; color:#444; line-height:1.9; }
.ci-row b { color:#333; }
.halves-now { display:flex; gap:8px; margin:10px 0 6px; }
.half-chip { flex:1; border:1.5px dashed #d9d9d9; border-radius:10px; padding:8px 6px; text-align:center; background:#fafbfc; }
.half-chip.active { border-style:solid; border-color:#18a058; background:#f0fbf5; }
.half-chip.disabled { background:#f5f5f5; border-color:#e0e0e0; opacity:.75; }
.hc-name { font-size:18px; font-weight:800; }
.hc-state { font-size:11.5px; margin-top:3px; line-height:1.5; font-weight:600; color:#18a058; }
.half-chip.disabled .hc-state { color:#999; font-weight:400; }
.court-actions { display:flex; gap:8px; flex-wrap:wrap; margin-top:8px; }
.opt-box { background:#f7f9fc; border-radius:8px; padding:8px 10px; margin-bottom:8px; font-size:12.5px; line-height:1.6; }
.occ-row { display:flex; gap:8px; align-items:center; padding:6px 4px; border-bottom:1px solid #f3f3f3; font-size:12.5px; }
.occ-time { color:#666; font-variant-numeric:tabular-nums; min-width:92px; }
</style>
