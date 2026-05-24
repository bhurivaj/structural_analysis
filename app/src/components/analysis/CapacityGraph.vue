<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import * as d3 from 'd3'
import type { AlternativeResult } from '@/utils/autoSize'

const props = defineProps<{
  alternatives: AlternativeResult[]
  currentProfileId: string | null
  urMarginal: number
  urFail: number
}>()

const svgRef = ref<SVGSVGElement | null>(null)

function draw() {
  const el = svgRef.value
  if (!el || props.alternatives.length === 0) return

  const W = el.clientWidth || 480
  const H = 200
  const margin = { top: 16, right: 16, bottom: 48, left: 44 }
  const innerW = W - margin.left - margin.right
  const innerH = H - margin.top - margin.bottom

  d3.select(el).selectAll('*').remove()
  el.setAttribute('viewBox', `0 0 ${W} ${H}`)

  const svg = d3
    .select(el)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`)

  const alts = [...props.alternatives].sort((a, b) => (a.profile.mass ?? 0) - (b.profile.mass ?? 0))

  const x = d3
    .scaleBand()
    .domain(alts.map(a => a.profile.id))
    .range([0, innerW])
    .padding(0.2)

  const maxUR = Math.max(...alts.map(a => a.urValues.UR_combined), props.urFail + 0.1)
  const y = d3.scaleLinear().domain([0, maxUR * 1.05]).range([innerH, 0])

  // Color zone fills
  const zones = [
    { y0: 0, y1: props.urMarginal, fill: '#d1fae5' },
    { y0: props.urMarginal, y1: props.urFail, fill: '#fef3c7' },
    { y0: props.urFail, y1: maxUR * 1.05, fill: '#fee2e2' },
  ]
  for (const z of zones) {
    const top = Math.min(z.y1, maxUR * 1.05)
    const bot = Math.max(z.y0, 0)
    if (top <= bot) continue
    svg
      .append('rect')
      .attr('x', 0)
      .attr('y', y(top))
      .attr('width', innerW)
      .attr('height', y(bot) - y(top))
      .attr('fill', z.fill)
      .attr('opacity', 0.6)
  }

  // Zone threshold lines
  for (const threshold of [props.urMarginal, props.urFail]) {
    if (threshold <= maxUR * 1.05) {
      svg
        .append('line')
        .attr('x1', 0).attr('x2', innerW)
        .attr('y1', y(threshold)).attr('y2', y(threshold))
        .attr('stroke', threshold === props.urFail ? '#ef4444' : '#f59e0b')
        .attr('stroke-dasharray', '4 3')
        .attr('stroke-width', 1)
    }
  }

  // Bars
  svg
    .selectAll('.bar')
    .data(alts)
    .join('rect')
    .attr('class', 'bar')
    .attr('x', d => x(d.profile.id)!)
    .attr('y', d => y(d.urValues.UR_combined))
    .attr('width', x.bandwidth())
    .attr('height', d => innerH - y(d.urValues.UR_combined))
    .attr('rx', 2)
    .attr('fill', d => {
      if (d.profile.id === props.currentProfileId) return '#6366f1'
      const st = d.urValues.status
      return st === 'PASS' ? '#10b981' : st === 'MARGINAL' ? '#f59e0b' : '#ef4444'
    })
    .attr('stroke', d => (d.profile.id === props.currentProfileId ? '#4338ca' : 'none'))
    .attr('stroke-width', 2)

  // X axis labels (designation, rotated)
  svg
    .append('g')
    .attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(x).tickFormat(id => {
      const alt = alts.find(a => a.profile.id === id)
      return alt?.profile.designation ?? ''
    }))
    .selectAll('text')
    .attr('transform', 'rotate(-35)')
    .attr('text-anchor', 'end')
    .attr('dx', '-0.4em')
    .attr('dy', '0.2em')
    .style('font-size', '9px')
    .style('fill', '#64748b')

  // Y axis
  svg
    .append('g')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('.2f')))
    .selectAll('text')
    .style('font-size', '9px')
    .style('fill', '#64748b')

  svg.selectAll('.domain').attr('stroke', '#e2e8f0')
  svg.selectAll('.tick line').attr('stroke', '#e2e8f0')
}

onMounted(draw)
watch(() => [props.alternatives, props.currentProfileId], draw)
</script>

<template>
  <div class="w-full">
    <svg ref="svgRef" class="w-full" style="height: 200px; overflow: visible" />
    <div v-if="alternatives.length === 0" class="text-xs text-slate-400 text-center py-4">
      No alternatives to graph.
    </div>
  </div>
</template>
