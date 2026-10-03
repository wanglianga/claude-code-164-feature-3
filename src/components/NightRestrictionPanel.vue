<script setup lang="ts">
import { computed } from 'vue'
import { NTag } from 'naive-ui'
import { useState } from '../store'
import { nightRestrictionEffect, teamRestriction } from '../lib/engine'
import RuleLink from './RuleLink.vue'

const state = useState()
const effect = computed(() => nightRestrictionEffect(state.noiseRecords))

const levelMeta: Record<number, { label: string; type: 'warning' | 'error' | 'default' }> = {
  0: { label: '未限制', type: 'default' },
  1: { label: '押金上浮 50%', type: 'warning' },
  2: { label: '押金上浮 + 限 20:00 前', type: 'error' }
}

function detail(teamKey: string) {
  return teamRestriction(teamKey, state.noiseRecords)
}
</script>

<template>
  <div class="night-panel">
    <div class="np-title">🌙 夜间限制效果（居民投诉是否下降）<RuleLink id="R-NIGHT-1" /></div>
    <div class="np-sub">
      按球队归并近 90 天经核实违规：<b>2 次 → 押金上浮 50%；3 次 → 仅可约 20:00 前结束时段</b>。
      下表对比各队<b>限制生效前 30 天</b>与<b>生效后至今</b>的投诉核实数量。
    </div>

    <div class="np-summary">
      <div class="np-kpi">
        <div class="k-n">{{ effect.beforeVerified }}</div>
        <div class="k-l">限制前 30 天<br />核实违规（合计）</div>
      </div>
      <div class="np-arrow">→</div>
      <div class="np-kpi">
        <div class="k-n" :class="{ down: effect.afterVerified < effect.beforeVerified }">{{ effect.afterVerified }}</div>
        <div class="k-l">限制生效后<br />核实违规（合计）</div>
      </div>
      <div class="np-kpi">
        <div class="k-n neutral">{{ effect.afterUnverified }}</div>
        <div class="k-l">限制后投诉<br />未核实成立</div>
      </div>
      <div class="np-kpi">
        <div class="k-n" :class="{ pending: effect.pending > 0 }">{{ effect.pending }}</div>
        <div class="k-l">待核验<br />投诉</div>
      </div>
    </div>

    <div v-if="effect.rows.length === 0" class="np-empty">暂无触发夜间限制的球队（需 90 天内 2 次及以上核实违规）</div>

    <div v-for="r in effect.rows" :key="r.teamKey" class="np-team">
      <div class="nt-head">
        <b>{{ r.teamName }}</b>
        <NTag size="tiny" round :type="levelMeta[r.level]?.type">{{ levelMeta[r.level]?.label }}</NTag>
        <span class="nt-since">限制自 {{ r.restrictedAt }} 起 · 已 {{ r.daysActive }} 天</span>
      </div>
      <div class="nt-compare">
        <div class="cmp-box before">
          <div class="cmp-n">{{ r.beforeVerified }}<span class="cmp-unit"> 次核实</span></div>
          <div class="cmp-l">生效前 30 天（共 {{ r.beforeTotal }} 条投诉）</div>
        </div>
        <div class="cmp-arrow">→</div>
        <div class="cmp-box after" :class="r.trend">
          <div class="cmp-n">{{ r.afterVerified }}<span class="cmp-unit"> 次核实</span></div>
          <div class="cmp-l">
            生效后（{{ r.afterTotal }} 条投诉{{ r.afterUnverified ? `，${r.afterUnverified} 条未核实` : '' }}）
            <span v-if="r.trend === 'down'" class="trend down">投诉核实下降 ✅</span>
            <span v-else-if="r.trend === 'up'" class="trend up">仍有新增 ⚠️</span>
            <span v-else class="trend flat">持平</span>
          </div>
        </div>
      </div>
      <div class="nt-foot">
        限制后最近关灯离场：<b>{{ r.lastLightOffAt ?? '—' }}</b>
        <template v-if="r.level === 0"> · 限制期已满且无新违规，已自动解除</template>
      </div>
      <details class="nt-reasons">
        <summary>查看历史违规原因（{{ detail(r.teamKey).violations }} 次）</summary>
        <div class="reason-lines">{{ detail(r.teamKey).reason }}</div>
      </details>
    </div>
    <div class="np-note">说明：限制依据为<b>现场核实</b>的投诉（实测超标）；未核实成立的投诉不计违规、不触发限制，但同样向居民书面答复（R-NOISE-1 / R-FAIR-3）。</div>
  </div>
</template>

<style scoped>
.night-panel { background:linear-gradient(135deg,#1f2a44,#2b3a67); color:#eef2ff; border-radius:12px; padding:12px; margin-bottom:12px; }
.np-title { font-weight:800; font-size:14px; }
.np-sub { font-size:11.5px; line-height:1.7; opacity:.88; margin:6px 0 10px; }
.np-summary { display:flex; align-items:center; gap:6px; }
.np-kpi { flex:1; background:rgba(255,255,255,.1); border-radius:10px; padding:8px 4px; text-align:center; }
.k-n { font-size:20px; font-weight:800; }
.k-n.down { color:#7ee2a8; }
.k-n.neutral { color:#c8d0e0; }
.k-n.pending { color:#ffd666; }
.k-l { font-size:10.5px; opacity:.85; line-height:1.4; margin-top:2px; }
.np-arrow { font-size:16px; opacity:.7; }
.np-empty { font-size:12px; opacity:.8; padding:8px 0; }
.np-team { background:rgba(255,255,255,.08); border-radius:10px; padding:9px 10px; margin-top:8px; }
.nt-head { display:flex; align-items:center; gap:6px; font-size:13px; flex-wrap:wrap; }
.nt-since { font-size:11px; opacity:.75; margin-left:auto; }
.nt-compare { display:flex; align-items:stretch; gap:6px; margin:8px 0 4px; }
.cmp-box { flex:1; border-radius:8px; padding:7px 8px; background:rgba(0,0,0,.22); }
.cmp-box.after.down { background:rgba(30,140,90,.35); }
.cmp-box.after.up { background:rgba(200,60,60,.3); }
.cmp-n { font-size:16px; font-weight:800; }
.cmp-unit { font-size:11px; font-weight:400; opacity:.85; }
.cmp-l { font-size:11px; opacity:.85; line-height:1.5; margin-top:2px; }
.cmp-arrow { align-self:center; opacity:.7; }
.trend { font-weight:700; margin-left:4px; }
.trend.down { color:#7ee2a8; }
.trend.up { color:#ffb3b3; }
.trend.flat { color:#ffd666; }
.nt-foot { font-size:11.5px; opacity:.9; }
.nt-reasons { margin-top:5px; font-size:11.5px; }
.nt-reasons summary { opacity:.85; }
.reason-lines { white-space:pre-line; background:rgba(0,0,0,.25); border-radius:8px; padding:7px 9px; margin-top:5px; line-height:1.8; }
.np-note { font-size:10.5px; opacity:.7; margin-top:8px; line-height:1.6; }
</style>
