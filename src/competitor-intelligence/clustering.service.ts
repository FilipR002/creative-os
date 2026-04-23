import { Injectable } from '@nestjs/common';
import { AdIntelItem, Cluster, ClusterType } from './types';

@Injectable()
export class ClusteringService {
  cluster(items: AdIntelItem[]): { items: AdIntelItem[]; clusters: Cluster[] } {
    const clusters: Cluster[] = [];
    const updated = [...items];

    // Cluster by emotional trigger
    const byEmotion = this.groupBy(items, i => i.emotionalTrigger);
    for (const [emotion, group] of Object.entries(byEmotion)) {
      const avgScore = group.reduce((s, i) => s + i.performanceSignal, 0) / group.length;
      const type: ClusterType = avgScore > 0.65 ? 'winning_hooks' :
                                avgScore < 0.3  ? 'saturated_patterns' : 'emerging_trends';
      const id = `emotion_${emotion}_${Date.now()}`;
      clusters.push({
        id,
        type,
        label: `${emotion.replace('_', ' ')} (${group.length} ads)`,
        items: group.map(i => i.id),
        avgScore: +avgScore.toFixed(3),
      });
      group.forEach(i => {
        const idx = updated.findIndex(u => u.id === i.id);
        if (idx >= 0) updated[idx] = { ...updated[idx], clusterId: id };
      });
    }

    // Cluster by format
    const byFormat = this.groupBy(items, i => i.format);
    for (const [format, group] of Object.entries(byFormat)) {
      if (group.length < 2) continue;
      const avgScore = group.reduce((s, i) => s + i.performanceSignal, 0) / group.length;
      const id = `format_${format}_${Date.now()}`;
      clusters.push({
        id,
        type: 'winning_formats',
        label: `${format.replace('_', ' ')} format (${group.length})`,
        items: group.map(i => i.id),
        avgScore: +avgScore.toFixed(3),
      });
    }

    clusters.sort((a, b) => b.avgScore - a.avgScore);
    return { items: updated, clusters };
  }

  private groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
    return arr.reduce((acc, item) => {
      const k = key(item);
      if (!acc[k]) acc[k] = [];
      acc[k].push(item);
      return acc;
    }, {} as Record<string, T[]>);
  }
}
