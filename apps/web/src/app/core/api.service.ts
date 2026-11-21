import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export type Industry = 'insurance' | 'lending' | 'broking' | 'healthcare' | 'other';

export interface OrgProfile {
  orgId: string;
  industry: Industry;
  languages: string[];
  timezone: string;
  onboardingStep: string;
  onboardingCompletedAt: string | null;
}

export interface AuditEntry {
  id: number;
  actorUserId: string | null;
  actorName: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  profile(): Promise<OrgProfile> {
    return firstValueFrom(this.http.get<OrgProfile>('/api/org/profile'));
  }

  updateProfile(patch: Partial<Pick<OrgProfile, 'industry' | 'languages' | 'onboardingStep'>>): Promise<OrgProfile> {
    return firstValueFrom(this.http.patch<OrgProfile>('/api/org/profile', patch));
  }

  audit(): Promise<{ entries: AuditEntry[]; chainIntact: boolean }> {
    return firstValueFrom(this.http.get<{ entries: AuditEntry[]; chainIntact: boolean }>('/api/org/audit'));
  }
}
