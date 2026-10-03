<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  NButton, NTag, NEmpty, NInput, NForm, NFormItem, NCheckbox,
  NInputNumber, NAlert, NSpace, NPopconfirm, NDivider, useMessage, NBadge
} from 'naive-ui'
import {
  useState, nowStr, addMember, toggleCheckIn, respondMerge,
  payDeposit, turnOnLight, endUsage, topUp, applyMerge, checkInByCode
} from '../store'
import { checkedInCount, rejectMergeCheck, hm, isActive, timeState, platformEndTime } from '../lib/engine'
import type { Booking, MergeRequest } from '../types'
import BookingCard from '../components/BookingCard.vue'
import BottomSheet from '../components/BottomSheet.vue'
import RuleLink from '../components/RuleLink.vue'

const state = useState()
const message = useMessage()

const isCaptain = computed(() => state.role === 'captain')
const isWalkin = computed(() => state.role === 'walkin')

// 队长视角：陈晨（演示）或新建预约（captainId u-me）
const myBookings = computed<Booking[]>(() =>
  state.bookings
    .filter(b => b.captainName === '陈晨' || b.captainId === 'u-me')
    .sort((a, b) => hm(b.start) - hm(a.start)))

// 待处理拼场申请
const pendingRequests = computed<MergeRequest[]>(() =>
  state.mergeRequests.filter(r =>
    r.status === 'pending' && myBookings.value.some(b => b.id === r.bookingId)))

// 邀请队员
const inviteTarget = ref<Booking | null>(null)
const inviteForm = ref({ name: '', phone: '', minor: false })
function submitInvite() {
  if (!inviteTarget.value || !inviteForm.value.name.trim()) return message.warning('请填写队员姓名')
  addMember(inviteTarget.value.id, inviteForm.value.name, inviteForm.value.phone, inviteForm.value.minor)
  message.success('已发送签到邀请，队员到场凭签到码签到')
  inviteForm.value = { name: '', phone: '', minor: false }
}

// 拒绝拼场
const rejectTarget = ref<{ req: MergeRequest; booking: Booking } | null>(null)
const rejectReason = ref('')
const rejectHint = computed(() => rejectTarget.value
  ? rejectMergeCheck(rejectTarget.value.booking, rejectTarget.value.req)
  : null)
function openReject(req: MergeRequest) {
  const booking = state.bookings.find(b => b.id === req.bookingId)!
  rejectTarget.value = { req, booking }
  rejectReason.value = ''
}
function submitReject(unreasonable: boolean) {
  if (!rejectTarget.value) return
  if (!unreasonable && !rejectReason.value.trim()) {
    return message.warning('请先填写正当理由；若确实没有理由，请点下方"坚持拒绝"')
  }
  respondMerge(rejectTarget.value.req.id, false, unreasonable ? '' : rejectReason.value)
  rejectTarget.value = null
  message.success('已提交')
}
function acceptMergeReq(req: MergeRequest) {
  respondMerge(req.id, true)
  message.success('已同意拼场，请等待散客到场签到')
}

// 照明 / 结算
function doPay(b: Booking) { payDeposit(b.id); message.success('押金支付成功，到场可开灯') }
function doLightOn(b: Booking) {
  if (checkedInCount(b) === 0) return message.warning('请先完成至少 1 人签到再开灯')
  turnOnLight(b.id); message.success('照明已开启，开始实时计费')
}
function doEnd(b: Booking) {
  const r = endUsage(b.id)
  if (r.needTopup > 0) message.warning(`需补缴 ¥${r.needTopup.toFixed(2)}，请在离场前结清`)
  else message.success(`已关灯结算，押金退回 ¥${r.balance.toFixed(2)}`)
}
function doTopUp(b: Booking) { topUp(b.id); message.success('已补缴结清') }

// 散客：找拼场
const mergeable = computed(() =>
  state.bookings
    .filter(b => b.acceptMerge && ['booked', 'ongoing'].includes(b.status))
    .filter(b => {
      const c = state.courts.find(x => x.id === b.courtId)!
      return !c.sealed && b.members.length < (b.scope === 'full' ? 14 : 8)
    })
    .sort((a, b) => hm(a.start) - hm(b.start)))

const applyTarget = ref<Booking | null>(null)
const applyForm = ref({ name: '王同学', phone: '150****3321', people: 1, message: '', minor: false })
function submitApply() {
  if (!applyTarget.value) return
  if (applyForm.value.minor && !applyForm.value.message.includes('监护人')) {
    return message.warning('未成年人参加夜场须监护人陪同，请在留言中说明（R-MINOR-1）')
  }
  applyMerge(applyTarget.value.id, applyForm.value.name, applyForm.value.phone,
    applyForm.value.people, applyForm.value.message, applyForm.value.minor)
  message.success('拼场申请已发送，队长须在 10 分钟内处理')
  applyTarget.value = null
}
const myApplications = computed(() =>
  state.mergeRequests.filter(r => r.walkerName === '王同学' || r.walkerPhone === applyForm.value.phone))

// 签到码自助签到
const codeForm = ref({ code: '', name: '王同学' })
function doCodeCheckIn() {
  if (!codeForm.value.code.trim()) return message.warning('请输入 6 位签到码')
  const ok = checkInByCode(codeForm.value.code.trim(), codeForm.value.name)
  if (ok) { message.success('签到成功！'); codeForm.value.code = '' }
  else message.error('签到码无效，请向队长确认')
}

function courtName(id: string) { return state.courts.find(c => c.id === id)?.name ?? '' }
function endOf(b: Booking) {
  const c = state.courts.find(x => x.id === b.courtId)!
  return platformEndTime({ start: b.start, end: b.end }, c)
}
</script>

<template>
  <div class="page">
    <!-- ============ 队长视角 ============ -->
    <template v-if="isCaptain">
      <NAlert type="info" :show-icon="false" style="margin-bottom:10px;border-radius:10px">
        <div style="font-size:12px">你是队长：可<b>邀请队员、处理拼场申请、管理签到、开关照明并结算</b>。签到码展示在每张卡片的时间线标题中。</div>
      </NAlert>

      <!-- 待处理拼场申请 -->
      <div v-if="pendingRequests.length" class="section-title">
        <NBadge :value="pendingRequests.length" type="warning" processing />
        <span style="margin-left:8px">待处理拼场申请（10 分钟内响应）</span>
      </div>
      <div v-for="req in pendingRequests" :key="req.id" class="merge-req">
        <div class="mr-head">
          <b>🙋 {{ req.walkerName }} 等 {{ req.people }} 人</b>
          <NTag size="tiny" type="warning">申请于 {{ req.time }}</NTag>
        </div>
        <div class="mr-team">申请加入：{{ state.bookings.find(b => b.id === req.bookingId)?.teamName }}</div>
        <div class="mr-msg">“{{ req.message }}”</div>
        <div v-if="req.minor" class="mr-minor">含未成年人 · 夜场须监护人陪同 <RuleLink id="R-MINOR-1" /></div>
        <div class="mr-actions">
          <NButton size="small" type="primary" round @click="acceptMergeReq(req)">同意拼场（8 折照明）</NButton>
          <NButton size="small" round type="error" ghost @click="openReject(req)">拒绝并填写理由</NButton>
        </div>
        <div style="font-size:11px;color:#999;margin-top:4px">
          同意后照明费按签到人数平摊；无正当理由拒绝收 20 元资源占用费、信用 -5 <RuleLink id="R-MERGE-1" />
        </div>
      </div>

      <div class="section-title">我的队伍预约</div>
      <NEmpty v-if="myBookings.length === 0" description="还没有预约，去场地页约一场吧" />

      <div v-for="b in myBookings" :key="b.id">
        <BookingCard :booking="b">
          <template #actions>
            <!-- 待开场 -->
            <template v-if="b.status === 'booked'">
              <NButton size="small" round @click="inviteTarget = b">👋 邀请队员</NButton>
              <NButton size="small" round @click="inviteTarget = b">✅ 队员签到</NButton>
              <NButton v-if="b.lighting.deposit === 0" size="small" round type="warning" @click="doPay(b)">💳 支付照明押金</NButton>
              <NButton size="small" round type="primary" @click="doLightOn(b)">💡 到场开灯</NButton>
            </template>
            <!-- 进行中 / 迟到 / 超时 -->
            <template v-else-if="isActive(b, nowStr)">
              <NButton size="small" round @click="inviteTarget = b">✅ 签到管理（{{ checkedInCount(b) }}/{{ b.members.length }}）</NButton>
              <NPopconfirm @positive-click="doEnd(b)">
                <template #trigger>
                  <NButton size="small" round type="error" ghost>🔚 结束使用并关灯</NButton>
                </template>
                关灯后按实际使用时长立即结算照明费，押金余额 1–3 个工作日退回。确定现在结束？
              </NPopconfirm>
              <NTag v-if="timeState(b, nowStr).overtimeMinutes > 0" type="error" size="small" round>
                超时 {{ timeState(b, nowStr).overtimeMinutes }} 分钟 · ¥2/分钟
              </NTag>
            </template>
            <!-- 已结算需补缴 -->
            <template v-else>
              <NButton v-if="b.payStatus === 'deducted'" size="small" type="error" round @click="doTopUp(b)">
                💸 离场前补缴
              </NButton>
              <NTag v-else size="small" type="success" round>已完成</NTag>
            </template>
          </template>
        </BookingCard>
      </div>
    </template>

    <!-- ============ 散客视角 ============ -->
    <template v-else-if="isWalkin">
      <NAlert type="info" :show-icon="false" style="margin-bottom:10px;border-radius:10px">
        <div style="font-size:12px;line-height:1.7">
          你是散客：可以<b>凭签到码签到</b>，也可以<b>找接受拼场的队伍申请加入</b>，拼场成功照明费按人均分摊。
        </div>
      </NAlert>

      <div class="section-title">签到码快速签到</div>
      <div class="walkin-code">
        <NInput v-model:value="codeForm.code" placeholder="输入队长给的 6 位签到码" maxlength="6"
          style="flex:1" :input-props="{ inputmode: 'numeric' }" />
        <NButton type="primary" round @click="doCodeCheckIn">签到</NButton>
      </div>

      <div class="section-title">找拼场（{{ mergeable.length }} 场可申请）</div>
      <NEmpty v-if="mergeable.length === 0" description="当前没有可拼的队伍，可去现场排队候补（R-FAIR-2）" />
      <div v-for="b in mergeable" :key="b.id" class="merge-card">
        <div class="mc-top">
          <b>{{ b.teamName }}</b>
          <NTag size="tiny" :type="b.status === 'ongoing' ? 'success' : 'info'">
            {{ b.status === 'ongoing' ? '已开场' : `${b.start} 开场` }}
          </NTag>
        </div>
        <div class="mc-row">📍 {{ courtName(b.courtId) }} · {{ b.scope === 'full' ? '全场' : '半场' }} {{ b.halves.join('+') }} · {{ b.start }}–{{ b.end }}</div>
        <div class="mc-row" :class="{ 'end-cut': endOf(b) !== b.end }">⏰ 统一关灯离场时间 <b>{{ endOf(b) }}</b><template v-if="endOf(b) !== b.end">（场地静音截止，名义预约至 {{ b.end }}）</template>，队员同此口径 <RuleLink id="R-NIGHT-1" /></div>
        <div class="mc-row">
          👥 已报名 {{ b.members.length }}/{{ b.scope === 'full' ? 14 : 8 }} 人 ·
          已签到 {{ checkedInCount(b) }} 人
          <template v-if="b.fixedTeam"> · <NTag size="tiny" type="info">固定球队</NTag></template>
        </div>
        <div class="mc-row">💡 拼场照明 8 折，按签到人数人均分摊 <RuleLink id="R-BOOK-2" /></div>
        <div class="mc-actions">
          <NButton size="small" type="primary" round
            :disabled="myApplications.some(r => r.bookingId === b.id && r.status === 'pending')"
            @click="applyTarget = b">
            {{ myApplications.some(r => r.bookingId === b.id && r.status === 'pending') ? '申请待队长处理' : '申请加入拼场' }}
          </NButton>
          <template v-for="r in myApplications.filter(x => x.bookingId === b.id)" :key="r.id">
            <NTag v-if="r.status === 'accepted'" size="small" type="success" round>已接受，凭码 {{ b.checkInCode }} 签到</NTag>
            <NTag v-else-if="r.status === 'rejected'" size="small" :type="r.unreasonable ? 'error' : 'default'" round>
              {{ r.unreasonable ? '被拒（队长已被计资源占用费）' : '被拒（对方有正当理由）' }}
            </NTag>
          </template>
        </div>
      </div>
    </template>

    <!-- 管理员 / 社区工作人员 -->
    <template v-else>
      <NEmpty description="管理员与社区工作人员请使用「现场看板」和「后台处置」标签页" />
    </template>

    <!-- 邀请队员 / 签到管理抽屉 -->
    <BottomSheet :show="!!inviteTarget" :title="inviteTarget ? `${inviteTarget.teamName} · 队员与签到（签到码 ${inviteTarget.checkInCode}）` : ''"
      @update:show="v => !v && (inviteTarget = null)">
      <div v-if="inviteTarget" class="invite-box">
        <div class="invite-endtime">
          ⏰ 本队统一结束（关灯离场）时间：<b>{{ endOf(inviteTarget) }}</b>
          <span v-if="endOf(inviteTarget) !== inviteTarget.end">（场地静音截止 {{ endOf(inviteTarget) }}，预约名义至 {{ inviteTarget.end }}）</span>
          ，全体队员按此时间离场 <RuleLink id="R-NIGHT-1" />
        </div>
        <div class="member-line" v-for="m in inviteTarget.members" :key="m.id">
          <span>
            <NTag v-if="m.isCaptain" size="tiny" type="info">队长</NTag>
            <NTag v-else-if="m.minor" size="tiny" type="warning">未成年</NTag>
            {{ m.name }}
            <span style="color:#999;font-size:12px;margin-left:4px">{{ m.phone }}</span>
          </span>
          <NButton size="tiny" round :type="m.checkedIn ? 'success' : 'default'"
            @click="toggleCheckIn(inviteTarget!.id, m.id)">
            {{ m.checkedIn ? `✅ 已签到 ${m.checkInAt}` : '签到' }}
          </NButton>
        </div>
        <NDivider />
        <NForm label-placement="top" size="small">
          <NFormItem label="邀请新队员（发送签到邀请）">
            <NSpace align="center" :wrap="false" style="width:100%">
              <NInput v-model:value="inviteForm.name" placeholder="队员姓名" style="flex:1" />
              <NInput v-model:value="inviteForm.phone" placeholder="手机号（选填）" style="flex:1" />
            </NSpace>
          </NFormItem>
          <NCheckbox v-model:checked="inviteForm.minor">该队员为未成年人（夜场须监护人陪同，R-MINOR-1）</NCheckbox>
          <NButton type="primary" block round style="margin-top:8px" @click="submitInvite">发送邀请</NButton>
        </NForm>
      </div>
    </BottomSheet>

    <!-- 拒绝拼场理由抽屉 -->
    <BottomSheet :show="!!rejectTarget" title="拒绝拼场 · 填写理由" @update:show="v => !v && (rejectTarget = null)">
      <NAlert v-if="rejectHint" :type="rejectHint.unreasonable ? 'error' : 'warning'" style="margin-bottom:10px">
        {{ rejectHint.hint }}
      </NAlert>
      <NInput v-model:value="rejectReason" type="textarea" :rows="3"
        placeholder="请填写正当理由（如：未成年人无监护人夜场、人数超额等）" />
      <NButton type="warning" block round style="margin-top:10px" :disabled="!rejectReason.trim()"
        @click="submitReject(false)">
        以正当理由拒绝（不收费）
      </NButton>
      <NPopconfirm placement="top" @positive-click="submitReject(true)">
        <template #trigger>
          <NButton size="tiny" quaternary type="error" block style="margin-top:8px">
            坚持无理由拒绝（收 20 元资源占用费、信用 -5）
          </NButton>
        </template>
        该申请可把队伍补至合理人数。确认无正当理由拒绝？将依据 R-MERGE-1 收取 20 元并扣信用 5 分。
      </NPopconfirm>
    </BottomSheet>

    <!-- 散客申请拼场抽屉 -->
    <BottomSheet :show="!!applyTarget" :title="applyTarget ? `申请加入 ${applyTarget.teamName}` : ''"
      @update:show="v => !v && (applyTarget = null)">
      <NForm v-if="applyTarget" label-placement="top" size="small">
        <NFormItem label="称呼">
          <NInput v-model:value="applyForm.name" />
        </NFormItem>
        <NFormItem label="手机号（仅队长可见）">
          <NInput v-model:value="applyForm.phone" />
        </NFormItem>
        <NFormItem label="人数">
          <NInputNumber v-model:value="applyForm.people" :min="1" :max="6" />
        </NFormItem>
        <NFormItem label="留言">
          <NInput v-model:value="applyForm.message" type="textarea" :rows="2"
            placeholder="介绍一下水平/是否带球，更容易通过哦" />
        </NFormItem>
        <NCheckbox v-model:checked="applyForm.minor">同行含未成年人（夜场须监护人陪同）</NCheckbox>
        <NButton type="primary" block round style="margin-top:10px" @click="submitApply">发送申请（队长 10 分钟内处理）</NButton>
      </NForm>
    </BottomSheet>
  </div>
</template>

<style scoped>
.section-title { font-size:13px; font-weight:700; color:#555; margin:12px 2px 8px; display:flex; align-items:center; }
.merge-req { background:#fff; border:1px solid #ffe7ba; border-radius:12px; padding:10px 12px; margin-bottom:10px; }
.mr-head { display:flex; justify-content:space-between; align-items:center; }
.mr-team { font-size:12px; color:#666; margin:4px 0; }
.mr-msg { font-size:13px; background:#f7f9fc; border-radius:8px; padding:6px 8px; }
.mr-minor { font-size:12px; color:#d03050; margin-top:4px; }
.mr-actions { display:flex; gap:8px; margin-top:8px; }
.walkin-code { display:flex; gap:8px; margin-bottom:10px; }
.merge-card { background:#fff; border-radius:12px; padding:10px 12px; margin-bottom:10px; box-shadow:0 1px 4px rgba(0,0,0,.06); }
.mc-top { display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; }
.mc-row { font-size:12px; color:#555; line-height:1.9; }
.mc-actions { display:flex; gap:8px; align-items:center; margin-top:6px; flex-wrap:wrap; }
.invite-box { padding-bottom:10px; }
.invite-endtime { background:#f0f7ff; color:#2b4a7a; border-radius:8px; padding:7px 9px; font-size:12px; line-height:1.6; margin-bottom:8px; }
.end-cut { color:#ad6800; }
.member-line { display:flex; justify-content:space-between; align-items:center; padding:8px 2px; border-bottom:1px solid #f2f2f2; font-size:13px; }
</style>
