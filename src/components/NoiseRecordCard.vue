<script setup lang="ts">
import { computed, ref } from 'vue'
import { NButton, NInput, NInputNumber, NTag, useMessage } from 'naive-ui'
import {
  useState, noiseRecordOfIncident, addNoiseReminder, setNoiseLightOff
} from '../store'
import type { Incident } from '../types'

const props = defineProps<{ incident: Incident }>()
const state = useState()
const message = useMessage()

const record = computed(() => noiseRecordOfIncident(props.incident.id))
const court = computed(() => state.courts.find(c => c.id === props.incident.courtId))
const booking = computed(() => state.bookings.find(b => b.id === props.incident.bookingIds[0]))

const editable = computed(() =>
  (state.role === 'worker' || state.role === 'admin') &&
  props.incident.status !== 'resolved' && props.incident.status !== 'penalized')

const reminderText = ref('')
const db = ref<number | null>(null)
const offTime = ref('')

function saveReminder(verified: boolean) {
  if (!record.value) return message.warning('噪声记录尚未建立')
  if (!reminderText.value.trim()) return message.warning('请填写现场提醒内容')
  addNoiseReminder(record.value.id, reminderText.value, db.value ?? undefined, verified)
  message.success(verified ? '现场提醒已写入噪声记录' : '已登记为未核实，并回访居民')
  reminderText.value = ''
  db.value = null
}
function saveOff() {
  if (!record.value) return
  const at = offTime.value.trim()
  setNoiseLightOff(record.value.id, at || undefined)
  message.success(`照明关闭时间已登记：${at || '当前时间'}`)
  offTime.value = ''
}

const outcomeMeta = {
  open: { label: '待核验', type: 'error' as const },
  firstWarned: { label: '首次劝导（计违规 1 次）', type: 'warning' as const },
  secondFined: { label: '二次核实收费（计违规 1 次）', type: 'default' as const },
  unverified: { label: '未核实成立（不计违规）', type: 'success' as const }
}
</script>

<template>
  <div class="nr-card">
    <div class="nr-title">
      🔊 噪声投诉留痕（投诉时间 · 使用队伍 · 关灯时间 · 现场提醒）
      <NTag v-if="record" size="tiny" round :type="outcomeMeta[record.outcome].type" style="margin-left:4px">
        {{ outcomeMeta[record.outcome].label }}
      </NTag>
    </div>

    <div v-if="!record" class="nr-empty">办结/处置时将自动生成噪声记录（R-NOISE-1）</div>
    <template v-else>
      <div class="nr-grid">
        <div class="nr-cell"><span class="k">投诉时间</span><b>{{ record.date }} {{ record.time }}</b></div>
        <div class="nr-cell"><span class="k">投诉人</span><b>{{ record.source }}</b></div>
        <div class="nr-cell">
          <span class="k">使用队伍</span>
          <b>{{ record.teamName }}</b>
          <span class="v">队长 {{ record.captainName }}（{{ record.teamKey }}）</span>
        </div>
        <div class="nr-cell">
          <span class="k">场地 / 静音截止</span>
          <b>{{ court?.name ?? '—' }}</b>
          <span class="v">{{ court ? court.noiseCurfew + ':00 须关灯离场' : '' }}</span>
        </div>
        <div class="nr-cell">
          <span class="k">照明关闭时间</span>
          <b :class="{ off: record.lightOffAt, missing: !record.lightOffAt }">
            {{ record.lightOffAt ?? '尚未登记' }}
          </b>
          <span v-if="booking" class="v">预约结束 {{ booking.end }} · 队伍结算关灯自动同步</span>
        </div>
      </div>

      <div class="nr-reminders">
        <div class="rm-title">管理员/社区现场提醒（{{ record.reminders.length }}）</div>
        <div v-if="record.reminders.length === 0" class="rm-empty">暂无现场提醒记录</div>
        <div v-for="(x, i) in record.reminders" :key="i" class="rm-item" :class="{ bad: !x.verified }">
          <span class="rm-at">{{ x.at }}</span>
          <NTag size="tiny" :type="x.by === 'admin' ? 'info' : 'warning'">
            {{ x.by === 'admin' ? '管理员' : '社区工作人员' }}
          </NTag>
          <NTag v-if="x.db" size="tiny" :type="x.db >= 65 ? 'error' : 'success'">实测 {{ x.db }}dB</NTag>
          <NTag v-else size="tiny" :type="x.verified ? 'default' : 'success'">{{ x.verified ? '已核实' : '未核实' }}</NTag>
          <span class="rm-text">{{ x.text }}</span>
        </div>
      </div>

      <div v-if="editable" class="nr-edit">
        <div class="edit-row">
          <NInput v-model:value="reminderText" size="small" type="textarea" :rows="2"
            placeholder="现场提醒/核验内容，如：实测 70dB，要求 21:00 前关灯离场" style="flex:1" />
          <NInputNumber v-model:value="db" size="small" placeholder="dB" :show-button="false"
            style="width:78px" :input-props="{ inputmode: 'numeric' }" />
        </div>
        <div class="edit-btns">
          <NButton size="tiny" round type="warning" ghost @click="saveReminder(true)">写入现场提醒（核实成立）</NButton>
          <NButton size="tiny" round type="success" ghost @click="saveReminder(false)">未超标·登记不成立</NButton>
        </div>
        <div class="edit-row" style="margin-top:6px">
          <NInput v-model:value="offTime" size="small" placeholder="照明关闭时间 HH:mm（留空=当前时钟）"
            style="flex:1" :input-props="{ inputmode: 'numeric' }" />
          <NButton size="small" round type="primary" ghost @click="saveOff">登记关灯时间</NButton>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.nr-card { background:#f4f7ff; border:1px solid #dce6ff; border-radius:10px; padding:9px 10px; margin:8px 0; }
.nr-title { font-size:12.5px; font-weight:700; color:#2b3a67; }
.nr-empty { font-size:12px; color:#999; margin-top:5px; }
.nr-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px 10px; margin-top:7px; }
.nr-cell { font-size:11.5px; line-height:1.5; display:flex; flex-direction:column; }
.nr-cell .k { color:#8a93a8; font-size:10.5px; }
.nr-cell .v { color:#99a; color:#98a0b3; font-size:10.5px; }
.nr-cell b.off { color:#18a058; }
.nr-cell b.missing { color:#e8840c; }
.nr-reminders { margin-top:8px; }
.rm-title { font-size:11.5px; font-weight:700; color:#555; margin-bottom:4px; }
.rm-empty { font-size:11.5px; color:#aaa; }
.rm-item { font-size:11.5px; line-height:1.7; background:#fff; border-radius:7px; padding:4px 7px; margin-bottom:4px; display:flex; gap:5px; flex-wrap:wrap; align-items:center; }
.rm-item.bad { background:#f3faf5; }
.rm-at { color:#999; font-variant-numeric:tabular-nums; }
.rm-text { width:100%; }
.nr-edit { border-top:1px dashed #c9d6f5; padding-top:7px; margin-top:6px; }
.edit-row { display:flex; gap:6px; align-items:flex-start; }
.edit-btns { display:flex; gap:6px; margin-top:6px; flex-wrap:wrap; }
</style>
