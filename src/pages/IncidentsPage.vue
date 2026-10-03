<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  NButton, NTag, NAlert, NInput, NRadioGroup, NRadio,
  NCollapse, NCollapseItem, NEmpty, useMessage
} from 'naive-ui'
import {
  useState, nowStr,
  resolveLightFault, resolveNoise, resolveMinor, issueSealOrder,
  ruleDispute, addIncidentAction, setIncidentStatus, resolveNoiseUnverified
} from '../store'
import { INCIDENT_META } from '../lib/engine'
import type { Incident, IncidentStatus, RoleId } from '../types'
import RuleLink from '../components/RuleLink.vue'
import NoiseRecordCard from '../components/NoiseRecordCard.vue'
import NightRestrictionPanel from '../components/NightRestrictionPanel.vue'
import { incidentFilter } from '../lib/ui'

const state = useState()
const message = useMessage()

const filter = ref<'all' | 'open' | 'mediating' | 'closed'>('all')
const typeFilter = ref<string>(incidentFilter.value ?? 'all')
if (incidentFilter.value) incidentFilter.value = null

const list = computed(() =>
  state.incidents
    .filter(i => filter.value === 'all'
      ? true
      : filter.value === 'closed'
        ? (i.status === 'resolved' || i.status === 'penalized')
        : i.status === filter.value)
    .filter(i => typeFilter.value === 'all' || i.type === typeFilter.value)
    .sort((a, b) => a.time.localeCompare(b.time)))

const statusMeta: Record<IncidentStatus, { label: string; type: 'default' | 'info' | 'warning' | 'success' | 'error' }> = {
  open: { label: '待核验', type: 'error' },
  mediating: { label: '调解/处理中', type: 'warning' },
  resolved: { label: '已办结', type: 'success' },
  penalized: { label: '已处罚办结', type: 'default' }
}

const canHandle = computed(() => state.role === 'admin' || state.role === 'worker')
const isAdmin = computed(() => state.role === 'admin')
const isWorker = computed(() => state.role === 'worker')

function linkedBookings(inc: Incident) {
  return inc.bookingIds.map(id => state.bookings.find(b => b.id === id)).filter(Boolean)
}
function courtName(id: string) { return state.courts.find(c => c.id === id)?.name ?? '—' }

// 通用处理记录
const noteText = ref<Record<string, string>>({})
function addNote(inc: Incident, close = false) {
  const text = (noteText.value[inc.id] ?? '').trim()
  if (!text) return message.warning('请填写处理记录')
  addIncidentAction(inc.id, state.role as RoleId, text)
  noteText.value[inc.id] = ''
  if (close) {
    setIncidentStatus(inc.id, 'resolved')
    message.success('处理记录已写入，工单办结')
  } else {
    if (inc.status === 'open') setIncidentStatus(inc.id, 'mediating')
    message.success('处理记录已写入工单时间线')
  }
}

// 照明故障
function lightChoice(inc: Incident, c: 'wait' | 'reschedule' | 'refund') {
  resolveLightFault(inc.id, c)
  message.success(c === 'wait' ? '已核验登记，等待维修' : c === 'reschedule' ? '已改约并全额退押金' : '已全额退款')
}

// 噪声
function noiseFirst(inc: Incident) { resolveNoise(inc.id, false); message.success('劝导办结，已告知再次核实后果') }
function noiseSecond(inc: Incident) { resolveNoise(inc.id, true); message.success('已收 50 元社区安宁费、同步夜间限制并答复居民') }
function noiseUnverified(inc: Incident) {
  resolveNoiseUnverified(inc.id, '现场实测噪声未超标，队伍已正常活动，投诉不成立')
  message.success('已登记投诉不成立（不计违规），并回访居民')
}

// 未成年人
function minorDone(inc: Incident) { resolveMinor(inc.id); message.success('监护人接回登记完成') }

// 封场
const sealForm = ref({ reason: '街道社区文化活动占用', recoverAt: '22:30' })
function doSeal(inc: Incident) {
  if (!sealForm.value.reason.trim()) return message.warning('请填写封场原因')
  issueSealOrder(inc.id, sealForm.value.reason, sealForm.value.recoverAt)
  message.success('封场令已签发，受影响队伍已自动退款/可改约')
}

// 篮筐争议裁决
const ruling = ref<Record<string, string>>({})
function doRule(inc: Incident) {
  const text = (ruling.value[inc.id] ?? '').trim()
  if (!text) return message.warning('请填写裁决结论')
  ruleDispute(inc.id, text)
  message.success('裁决已记录并同步双方')
}

const typeOptions = [
  { label: '全部类型', value: 'all' },
  ...Object.entries(INCIDENT_META).map(([value, m]) => ({ label: `${m.emoji} ${m.label}`, value }))
]
</script>

<template>
  <div class="page">
    <NAlert type="info" :show-icon="false" style="margin-bottom:10px;border-radius:10px">
      <div style="font-size:12px;line-height:1.7">
        所有争议<b>先现场核验、再按规则处理</b>：预约权益、退款补偿、投诉答复与后续处罚全部记入工单，市民与居民均可查看留痕。
        当前身份：<b>{{ isAdmin ? '管理员（可处置全部工单）' : isWorker ? '社区工作人员（噪声/未成年人/调解）' : '市民（只读查看处理结果）' }}</b>
      </div>
    </NAlert>

    <!-- 社区端：夜间限制是否降低投诉 -->
    <NightRestrictionPanel />

    <div class="filters">
      <NRadioGroup v-model:value="filter" size="small">
        <NRadio value="all">全部</NRadio>
        <NRadio value="open">待核验</NRadio>
        <NRadio value="mediating">处理中</NRadio>
        <NRadio value="closed">已办结</NRadio>
      </NRadioGroup>
      <select v-model="typeFilter" class="type-select">
        <option v-for="o in typeOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
    </div>

    <NEmpty v-if="list.length === 0" description="没有符合条件的工单" />

    <div v-for="inc in list" :key="inc.id" class="inc-card" :class="{ closed: inc.status === 'resolved' || inc.status === 'penalized' }">
      <div class="ic-head">
        <div>
          <b>{{ INCIDENT_META[inc.type].emoji }} {{ inc.title }}</b>
          <NTag size="tiny" round style="margin-left:6px" :type="statusMeta[inc.status].type">{{ statusMeta[inc.status].label }}</NTag>
        </div>
        <span class="ic-time">{{ inc.time }}</span>
      </div>
      <div class="ic-meta">📍 {{ courtName(inc.courtId) }} · 关联预约 {{ inc.bookingIds.length ? inc.bookingIds.join('、') : '（全场地）' }}</div>
      <div class="ic-desc">{{ inc.desc }}</div>
      <div class="ic-source">📞 来源/投诉人：{{ inc.source }}</div>

      <!-- 噪声投诉：四要素聚合留痕 -->
      <NoiseRecordCard v-if="inc.type === 'noise'" :incident="inc" />

      <!-- 关联预约权益状态 -->
      <div v-if="linkedBookings(inc).length" class="ic-links">
        <span style="font-size:11px;color:#999">关联队伍权益：</span>
        <NTag v-for="b in linkedBookings(inc)" :key="b!.id" size="tiny" :bordered="false">
          {{ b!.teamName }} · {{ b!.status === 'sealed' ? '封场退款' : b!.status === 'rescheduled' ? '已改约补偿' : b!.status === 'cancelled' ? '已取消退款' : b!.payStatus }}
        </NTag>
      </div>

      <!-- 处置时间线 -->
      <NCollapse>
        <NCollapseItem :title="`核验与处置记录（${inc.actions.length} 条）`" name="a">
          <div class="tl">
            <div v-for="(a, i) in inc.actions" :key="i" class="tl-item">
              <span class="tl-at">{{ a.at }}</span>
              <NTag size="tiny" :type="a.by === 'admin' ? 'info' : a.by === 'worker' ? 'warning' : 'default'">
                {{ a.by === 'admin' ? '管理员' : a.by === 'worker' ? '社区' : a.by === 'captain' ? '队长' : '散客' }}
              </NTag>
              <span style="margin-left:4px">{{ a.text }}</span>
            </div>
          </div>
          <div v-if="inc.ruleApplied?.length" style="margin-top:6px">
            <span style="font-size:11px;color:#999">适用规则：</span>
            <RuleLink v-for="r in inc.ruleApplied" :key="r" :id="r" />
          </div>
          <div v-if="inc.penalty" class="ic-penalty">后续处罚/结论：{{ inc.penalty }}</div>
        </NCollapseItem>
      </NCollapse>

      <!-- 处置区（按事件类型） -->
      <div v-if="canHandle && inc.status !== 'resolved' && inc.status !== 'penalized'" class="ic-handle">
        <!-- 照明故障 -->
        <template v-if="inc.type === 'lightFault'">
          <div class="handle-title" v-if="isAdmin">💡 现场核验后，由队伍三选一（R-LIGHT-3）：</div>
          <div class="handle-btns" v-if="isAdmin">
            <NButton size="small" round @click="lightChoice(inc, 'wait')">核验属实·等维修（超30分赠券）</NButton>
            <NButton size="small" round type="primary" @click="lightChoice(inc, 'reschedule')">改约其他场地（优先排位）</NButton>
            <NButton size="small" round type="error" ghost @click="lightChoice(inc, 'refund')">全额退款办结</NButton>
          </div>
          <div v-else class="handle-title">照明故障需管理员现场核验计费设备，请通知管理员。</div>
        </template>

        <!-- 噪声 -->
        <template v-else-if="inc.type === 'noise'">
          <div class="handle-title" v-if="isWorker">🔊 到场噪声核验（R-NOISE-1，投诉处理过程须答复居民并留痕；核实违规累计 2 次将触发 R-NIGHT-1 夜间限制）：</div>
          <div class="handle-btns" v-if="isWorker">
            <NButton size="small" round type="primary" @click="noiseFirst(inc)">首次劝导·办结（计 1 次违规）</NButton>
            <NButton size="small" round type="error" ghost @click="noiseSecond(inc)">24h内第2次核实·收50元（触发/升级限制）</NButton>
            <NButton size="small" round type="success" ghost @click="noiseUnverified(inc)">现场未超标·投诉不成立</NButton>
          </div>
          <div v-else class="handle-title">
            噪声投诉由社区工作人员到场核验处置；管理员可在下方补记现场提醒与照明关闭时间。
          </div>
        </template>

        <!-- 未成年人 -->
        <template v-else-if="inc.type === 'minorNight'">
          <div class="handle-title" v-if="isWorker">🧒 监护人到场接回后登记（R-MINOR-1，不计收费）：</div>
          <div class="handle-btns" v-if="isWorker">
            <NButton size="small" round type="primary" @click="minorDone(inc)">监护人已接回·登记办结</NButton>
          </div>
        </template>

        <!-- 封场 -->
        <template v-else-if="inc.type === 'seal'">
          <template v-if="isAdmin">
            <div class="handle-title">🚧 签发封场令（原因/范围/恢复时间将公示，在封场次自动退款：R-SEAL-1）</div>
            <div class="seal-inputs">
              <NInput v-model:value="sealForm.reason" size="small" placeholder="封场原因" />
              <NInput v-model:value="sealForm.recoverAt" size="small" placeholder="恢复时间 如 22:30" style="width:110px" />
              <NButton size="small" type="error" round @click="doSeal(inc)">签发封场令</NButton>
            </div>
          </template>
          <div v-else class="handle-title">封场令由管理员签发。</div>
        </template>

        <!-- 篮筐争议 -->
        <template v-else-if="inc.type === 'hoopDispute'">
          <template v-if="isAdmin">
            <div class="handle-title">🥊 裁决依据：预约码 + 签到记录 + 时段比对（R-DISPUTE-1）</div>
            <NInput v-model:value="ruling[inc.id]" type="textarea" :rows="2" size="small"
              placeholder="填写裁决结论，如：H2 归 XX 队（已签到、时段内）；另一队当场退款并安排优先改约" />
            <div class="handle-btns" style="margin-top:6px">
              <NButton size="small" type="primary" round @click="doRule(inc)">记录裁决并同步双方</NButton>
            </div>
          </template>
          <div v-else class="handle-title">社区工作人员可先劝导稳控，篮筐归属由管理员裁决。</div>
        </template>

        <!-- 下雨/维修：核验记录 -->
        <template v-else>
          <div class="handle-title">现场核验记录（适用 <RuleLink :id="inc.type === 'rain' ? 'R-WX-1' : 'R-WX-2'" />）：</div>
        </template>

        <!-- 通用补充记录（噪声工单已在上方噪声记录卡内登记现场提醒/关灯时间） -->
        <div v-if="inc.type !== 'noise'" class="note-box">
          <NInput v-model:value="noteText[inc.id]" type="textarea" :rows="2" size="small"
            :placeholder="`${state.role === 'admin' ? '管理员' : '社区工作人员'}到场核验情况与处理措施（必填后写入工单）`" />
          <div class="handle-btns" style="margin-top:6px">
            <NButton size="small" round @click="addNote(inc)">写入记录</NButton>
            <NButton v-if="canHandle" size="small" round type="success" ghost
              @click="addNote(inc, true)">记录并办结工单</NButton>
          </div>
        </div>
        <!-- 噪声工单：管理员可直接办结 -->
        <div v-else-if="inc.type === 'noise' && isAdmin" class="note-box">
          <NInput v-model:value="noteText[inc.id]" type="textarea" :rows="2" size="small"
            placeholder="管理员现场核验/监督关灯等补充记录（选填）" />
          <div class="handle-btns" style="margin-top:6px">
            <NButton size="small" round @click="addNote(inc)">写入记录</NButton>
            <NButton size="small" round type="success" ghost @click="addNote(inc, true)">记录并办结工单</NButton>
          </div>
        </div>
      </div>

      <div v-else-if="!canHandle" class="ic-readonly">
        工单处理中/已办结，处理记录已向市民和居民公开；如有异议可在 24 小时内申请社区复核 <RuleLink id="R-FAIR-3" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.filters { display:flex; justify-content:space-between; gap:8px; margin-bottom:10px; flex-wrap:wrap; align-items:center; }
.type-select { font-size:12px; border:1px solid #e0e0e6; border-radius:6px; padding:3px 6px; background:#fff; }
.inc-card { background:#fff; border-radius:12px; padding:10px 12px; margin-bottom:10px; box-shadow:0 1px 4px rgba(0,0,0,.06); border-left:3px solid #d03050; }
.inc-card.closed { border-left-color:#18a058; opacity:.92; }
.ic-head { display:flex; justify-content:space-between; align-items:center; }
.ic-time { font-size:11px; color:#999; }
.ic-meta { font-size:12px; color:#888; margin:4px 0; }
.ic-desc { font-size:13px; line-height:1.7; background:#f7f9fc; border-radius:8px; padding:7px 9px; }
.ic-source { font-size:12px; color:#666; margin-top:5px; }
.ic-links { display:flex; gap:4px; align-items:center; flex-wrap:wrap; margin-top:6px; }
.ic-handle { border-top:1px dashed #eee; margin-top:6px; padding-top:8px; }
.handle-title { font-size:12px; color:#444; margin-bottom:6px; line-height:1.6; }
.handle-btns { display:flex; gap:6px; flex-wrap:wrap; }
.seal-inputs { display:flex; gap:6px; flex-wrap:wrap; }
.note-box { margin-top:8px; }
.ic-penalty { background:#fff7e6; border-radius:6px; padding:5px 7px; font-size:12px; color:#7a4d00; margin-top:6px; }
.ic-readonly { font-size:12px; color:#999; border-top:1px dashed #eee; padding-top:8px; }
.tl-item { font-size:12px; line-height:1.9; }
.tl-at { color:#999; margin-right:6px; }
</style>
