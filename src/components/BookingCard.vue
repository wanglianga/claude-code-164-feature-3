<script setup lang="ts">
import { computed } from 'vue'
import {
  NButton, NCollapse, NCollapseItem, NDivider, NGrid, NGridItem, NProgress, NTag, NText
} from 'naive-ui'
import type { Booking } from '../types'
import {
  STATUS_META, PAY_META, FEE_META, RESTRICTION_META, bookingRisk, checkedInCount,
  effectiveNightEnd, feeSummary, fmt, hm, isActive, money, timeState
} from '../lib/engine'
import { courtById, lightLive, nowStr, nightRestrictionForBooking, useState } from '../store'
import RuleLink from './RuleLink.vue'
import RiskTag from './RiskTag.vue'

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
const restriction = computed(() => nightRestrictionForBooking(props.booking))
const isNight = computed(() => hm(props.booking.start) >= court.value.lighting.autoOnHour * 60)
const nightEnd = computed(() => effectiveNightEnd(props.booking, court.value, restriction.value))

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

    <!-- 进行中：剩余时间大字 + 进度条 -->
    <div v-if="isActive(booking, nowStr) || booking.status === 'booked'" class="bc-live">
      <div class="bc-remain" :class="'r-' + remainType">{{ remainText }}</div>
      <NProgress
        v-if="isActive(booking, nowStr)"
        type="line" :percentage="progress" :show-indicator="false"
        :status="remainType === 'error' ? 'error' : remainType === 'warning' ? 'warning' : 'success'"
        :height="6" />
    </div>

    <!-- 夜间场次：结束时间 / 静音截止对队长与每名队员公示（R-NOISE-3） -->
    <div v-if="isNight" class="night-bar" :class="{ limited: restriction && restriction.level !== 'none' && restriction.level !== 'watch' }">
      🌙 队员须知：平台结束时间 <b>{{ nightEnd }}</b> · 场地静音截止 {{ court.noiseCurfew }}:00，到点照明自动关闭；
      结束时间以平台为准，队长口头延长无效 <RuleLink id="R-NOISE-3" />
      <div v-if="restriction && restriction.level !== 'none'" class="nb-rest">
        本队夜间限制：{{ RESTRICTION_META[restriction.level].label }}<template v-if="restriction.latestEnd"> · 最晚结束 {{ restriction.latestEnd }}</template>
      </div>
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
.bc-live { margin:8px 0; }
.night-bar { background:#eef4ff; border:1px solid #d6e4ff; border-radius:8px; padding:6px 9px; font-size:11.5px; color:#33507a; line-height:1.7; margin:6px 0; }
.night-bar.limited { background:#fff7e6; border-color:#ffe7ba; color:#7a4d00; }
.nb-rest { font-weight:600; margin-top:2px; }
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
