<script setup lang="ts">
import { computed } from 'vue'
import {
  NButton, NCollapse, NCollapseItem, NDivider, NGrid, NGridItem, NProgress, NTag, NText
} from 'naive-ui'
import type { Booking } from '../types'
import {
  STATUS_META, PAY_META, FEE_META, checkedInCount, feeSummary,
  fmt, hm, isActive, money, timeState, platformEndTime, restrictionOf
} from '../lib/engine'
import { courtById, lightLive, nowStr } from '../store'
import RuleLink from './RuleLink.vue'
import RiskTag from './RiskTag.vue'
import { bookingRisk } from '../lib/engine'
import { useState } from '../store'

const props = defineProps<{
  booking: Booking
  showCourt?: boolean
  compact?: boolean
}>()

const state = useState()
const court = computed(() => courtById(props.booking.courtId))
const light = computed(() => lightLive(props.booking))
const ts = computed(() => timeState(props.booking, nowStr.value))
const risk = computed(() => bookingRisk(props.booking, state.incidents, nowStr.value))
const present = computed(() => checkedInCount(props.booking))
const summary = computed(() => feeSummary(props.booking, court.value, nowStr.value, !!light.value?.frozen))
/** 平台统一结束（关灯离场）时间：队员与队长同一口径 */
const endTime = computed(() => platformEndTime(
  { start: props.booking.start, end: props.booking.end }, court.value))
const night = computed(() => restrictionOf(
  { captainPhone: props.booking.captainPhone, captainName: props.booking.captainName },
  state.noiseRecords))
const nightLevel = computed(() => props.booking.nightLock ?? night.value.level)

const remainText = computed(() => {
  if (props.booking.status === 'booked') {
    return ts.value.untilStart > 0 ? `距开场 ${fmt(ts.value.untilStart)}` : '已到开场时间'
  }
  if (!isActive(props.booking, nowStr.value)) return ''
  if (ts.value.overtimeMinutes > 0) return `已超时 ${ts.value.overtimeMinutes} 分钟`
  if (ts.value.inGrace) return '清场缓冲中（5 分钟）'
  return `还能打 ${fmt(ts.value.remaining)}`
})

const remainType = computed(() => {
  if (ts.value.overtimeMinutes > 0) return 'error'
  if (ts.value.inGrace) return 'warning'
  if (ts.value.remaining <= 15) return 'warning'
  return 'success'
})

const progress = computed(() => {
  const total = hm(props.booking.end) - hm(props.booking.start)
  const used = Math.min(total, Math.max(0, hm(nowStr.value) - hm(props.booking.start)))
  return total > 0 ? Math.round((used / total) * 100) : 0
})
</script>

<template>
  <div class="booking-card">
    <div class="bc-head">
      <div>
        <span class="bc-team">{{ booking.teamName }}</span>
        <NTag v-if="booking.fixedTeam" size="tiny" type="info" round style="margin-left:6px">固定球队</NTag>
        <NTag v-else size="tiny" round style="margin-left:6px">散客/临时</NTag>
      </div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end">
        <RiskTag :level="risk.level" :reasons="risk.reasons" />
        <NTag :type="STATUS_META[booking.status].type" size="small" round>{{ STATUS_META[booking.status].label }}</NTag>
      </div>
    </div>

    <div class="bc-row">
      <span class="bc-label">场地</span>
      <span v-if="showCourt !== false">{{ court.name }} · {{ booking.scope === 'full' ? '全场' : '半场' }} {{ booking.halves.join('+') }}</span>
      <span v-else>{{ booking.scope === 'full' ? '全场' : '半场' }} {{ booking.halves.join('+') }}</span>
      <span style="flex:1"></span>
      <NText depth="3" style="font-size:12px">{{ booking.date }} {{ booking.start }}–{{ booking.end }}</NText>
    </div>

    <!-- 夜间限制告知：队长历史违规原因 + 本次押金规则（队员同样可见） -->
    <div v-if="nightLevel >= 1" class="bc-night">
      <div class="bn-line">
        🌙 <b>夜间限制 L{{ nightLevel }}</b>（R-NIGHT-1）：
        <template v-if="nightLevel === 1">30 天内夜间预约照明押金<b>上浮 50%</b>（半场 50→75 / 全场 100→150），正常关灯离场且无新核实投诉全额退回。</template>
        <template v-else>30 天内<b>仅可预约 20:00 前结束时段</b>、照明押金上浮 50%，期内再违规重新起算 30 天。</template>
      </div>
      <div class="bn-reason">历史违规原因：近 90 天核实违规 {{ night.violations }} 次<span v-if="night.records.length">（{{ night.records.filter(r => r.outcome === 'firstWarned' || r.outcome === 'secondFined').map(r => r.date).slice(-3).join('、') }}）</span>。
        <RuleLink id="R-NIGHT-1" />
      </div>
    </div>

    <!-- 统一结束（关灯离场）时间：队长与队员同一口径 -->
    <div class="bc-endtime" :class="{ cut: endTime !== booking.end }">
      ⏰ 统一结束时间（关灯离场）：<b>{{ endTime }}</b>
      <template v-if="endTime !== booking.end"> · 场地 {{ court.noiseCurfew }}:00 静音截止，预约名义至 {{ booking.end }} 也须 {{ endTime }} 离场</template>
      <span class="be-note">（全体队员可见，队长口头承诺不改变平台规则）</span>
    </div>

    <!-- 进行中：剩余时间大字 + 进度条 -->
    <div v-if="isActive(booking, nowStr) || booking.status === 'booked'" class="bc-live">
      <div class="bc-remain" :class="'r-' + remainType">{{ remainText }}</div>
      <NProgress
        v-if="isActive(booking, nowStr)"
        type="line" :percentage="progress" :show-indicator="false"
        :status="remainType === 'error' ? 'error' : remainType === 'warning' ? 'warning' : 'success'"
        :height="6" />
    </div>

    <NGrid :cols="3" :x-gap="8" class="bc-stats">
      <NGridItem>
        <div class="stat-num">{{ present }}/{{ booking.members.length }}</div>
        <div class="stat-label">实际到场/名单</div>
      </NGridItem>
      <NGridItem>
        <div class="stat-num">{{ light ? light.minutes + ' 分' : '—' }}</div>
        <div class="stat-label">照明已用时长</div>
      </NGridItem>
      <NGridItem>
        <div class="stat-num" :style="{ color: light ? '#e8840c' : undefined }">
          {{ light ? '¥' + money(light.fee) : '¥0' }}
        </div>
        <div class="stat-label">照明费{{ light?.frozen ? '（已冻结）' : '（实时）' }}</div>
      </NGridItem>
    </NGrid>

    <div class="bc-row" v-if="light">
      <span class="bc-label">照明</span>
      <span style="font-size:12px">
        {{ booking.lighting.onAt }} 开灯 ·
        单价 ¥{{ court.lighting.pricePerMinute }}/分钟{{ booking.scope === 'full' ? ' × 2 半场' : '' }}
        <template v-if="light.rate < 1"> · 拼场 8 折</template>
        · 人均约 ¥{{ money(light.perPerson) }}
      </span>
    </div>
    <div class="bc-row">
      <span class="bc-label">支付</span>
      <NTag :type="PAY_META[booking.payStatus].type" size="tiny" round>{{ PAY_META[booking.payStatus].label }}</NTag>
      <span style="flex:1"></span>
      <span style="font-size:12px">押金 ¥{{ booking.lighting.deposit }}</span>
    </div>

    <div v-if="summary.items.length > 0 || light" class="bc-fees">
      <div v-for="(f, i) in summary.items" :key="i" class="fee-line">
        <span>
          <NTag size="tiny" :type="FEE_META[f.kind]?.type ?? 'default'">{{ FEE_META[f.kind]?.label ?? f.label }}</NTag>
          <span class="fee-note">{{ f.note }}</span>
        </span>
        <span :style="{ color: f.amount < 0 ? '#18a058' : '#d03050', fontWeight: 600 }">
          {{ f.amount < 0 ? '-' : '+' }}¥{{ money(Math.abs(f.amount)) }}
        </span>
      </div>
      <div v-if="light" class="fee-line fee-light-live">
        <span>照明实时累计 <RuleLink id="R-LIGHT-1" /></span>
        <span style="color:#e8840c;font-weight:700">¥{{ money(light.fee) }}</span>
      </div>
      <div class="fee-line fee-total">
        <span>当前应计合计 / 押金</span>
        <span :style="{ color: summary.depositBalance < 0 ? '#d03050' : '#18a058', fontWeight: 700 }">
          ¥{{ money(summary.charges) }} / ¥{{ summary.deposit }}
          （<template v-if="isActive(booking, nowStr)">{{ summary.depositBalance < 0 ? '结束时需补缴 ¥' + money(-summary.depositBalance) : '预计可退 ¥' + money(summary.depositBalance) }}</template><template v-else>{{ summary.depositBalance < 0 ? '需补缴 ¥' + money(-summary.depositBalance) : '可退 ¥' + money(summary.depositBalance) }}</template>）
        </span>
      </div>
    </div>

    <div v-if="booking.adminNote" class="bc-admin-note">
      <b>管理员说明：</b>{{ booking.adminNote }}
    </div>

    <div v-if="$slots.actions" class="bc-actions">
      <slot name="actions" />
    </div>

    <NCollapse v-if="!compact">
      <NCollapseItem title="权益/核验记录时间线 · 签到码 {{ booking.checkInCode }}" name="tl">
        <div class="tl">
          <div v-for="(t, i) in booking.timeline" :key="i" class="tl-item">
            <span class="tl-dot" :class="'dot-' + (t.tone ?? 'default')"></span>
            <span class="tl-at">{{ t.at }}</span>
            <span>{{ t.text }}</span>
          </div>
        </div>
        <NDivider style="margin:8px 0" />
        <div style="font-size:12px;color:#666;line-height:1.8">
          队长 {{ booking.captainName }} {{ booking.captainPhone }} · 信用分 {{ booking.credit }}
          <template v-if="booking.lockerNos?.length"> · 更衣柜 {{ booking.lockerNos.join('、') }}号</template>
        </div>
        <div v-if="!compact" style="margin-top:6px">
          <template v-for="f in booking.fees" :key="f.kind + f.label">
            <RuleLink :id="f.ruleId" />
          </template>
        </div>
      </NCollapseItem>
    </NCollapse>
  </div>
</template>

<style scoped>
.booking-card {
  background: #fff;
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 10px;
  box-shadow: 0 1px 4px rgba(0,0,0,.06);
}
.bc-head { display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:8px; }
.bc-team { font-weight: 700; font-size: 15px; }
.bc-row { display:flex; align-items:center; gap:6px; font-size:13px; margin:4px 0; color:#333; }
.bc-label { color:#999; font-size:12px; min-width:34px; }
.bc-night { background:#fff3f0; border:1px solid #ffd2c4; border-radius:9px; padding:7px 9px; margin:7px 0; font-size:12px; line-height:1.7; color:#7a2b1d; }
.bn-line b { color:#cf4328; }
.bn-reason { color:#9a6a5e; font-size:11.5px; margin-top:2px; }
.bc-endtime { background:#f0f7ff; border-radius:8px; padding:6px 9px; font-size:12px; color:#2b4a7a; line-height:1.6; margin-bottom:6px; }
.bc-endtime.cut { background:#fff7e6; color:#7a4d00; }
.bc-endtime b { font-size:14px; }
.be-note { color:#99a; color:#98a0b3; font-size:10.5px; margin-left:2px; }
.bc-live { margin:8px 0; }
.bc-remain { font-size:22px; font-weight:800; margin-bottom:4px; }
.r-success { color:#18a058; }
.r-warning { color:#f0a020; }
.r-error { color:#d03050; }
.bc-stats { background:#f7f9fc; border-radius:10px; padding:8px 4px; margin:8px 0; text-align:center; }
.stat-num { font-size:17px; font-weight:700; }
.stat-label { font-size:11px; color:#909399; margin-top:2px; }
.bc-fees { border-top:1px dashed #e5e6eb; margin-top:8px; padding-top:8px; }
.fee-line { display:flex; justify-content:space-between; align-items:center; gap:8px; font-size:12px; margin:5px 0; }
.fee-note { color:#999; margin-left:6px; }
.fee-light-live { color:#e8840c; }
.fee-total { border-top:1px solid #f0f0f0; padding-top:6px; margin-top:6px; font-size:13px; }
.bc-admin-note { background:#fff7e6; border:1px solid #ffe7ba; border-radius:8px; padding:8px; font-size:12px; line-height:1.7; margin-top:8px; color:#7a4d00; }
.bc-actions { display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; }
.tl { position:relative; padding-left:4px; }
.tl-item { position:relative; padding-left:16px; font-size:12px; line-height:1.8; color:#444; }
.tl-dot { position:absolute; left:2px; top:8px; width:7px; height:7px; border-radius:50%; background:#c0c4cc; }
.dot-success { background:#18a058; }
.dot-warning { background:#f0a020; }
.dot-error { background:#d03050; }
.dot-info { background:#2080f0; }
.tl-at { color:#999; margin-right:6px; font-variant-numeric:tabular-nums; }
</style>
