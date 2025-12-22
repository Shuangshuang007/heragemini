// ============================================
// AgentKit Planner - Intent Recognition & Plan Generation
// ============================================

import { parseMessageWithGPT } from '../../gpt-services/assistant/parseMessage';
import type { AgentKitPlan, AgentStep, AgentKitIntent } from './types';

/**
 * AgentKit Planner - Generates execution plans based on user intent
 */
export class AgentKitPlanner {
  
  /**
   * Generate execution plan based on user message and context
   */
  async generatePlan(
    userMessage: string, 
    sessionId: string, 
    userContext?: any
  ): Promise<AgentKitPlan> {
    console.log('[AgentKitPlanner] Generating plan for:', userMessage);

    try {
      // Use existing parseMessageWithGPT for intent recognition
      const intentResponse = await parseMessageWithGPT({ 
        message: userMessage, 
        context: userContext?.history || [],
        jobContext: userContext?.jobContext 
      });

      const intent = this.parseIntent(intentResponse);
      const steps = await this.generateSteps(intent, userContext);

      const plan: AgentKitPlan = {
        planId: this.generateId(),
        sessionId,
        steps,
        intent,
        createdAt: new Date(),
        status: 'draft'
      };

      console.log('[AgentKitPlanner] Generated plan:', plan.planId, 'with', steps.length, 'steps');
      return plan;

    } catch (error) {
      console.error('[AgentKitPlanner] Error generating plan:', error);
      
      // Fallback plan - always provide a basic job recommendation
      return this.createFallbackPlan(sessionId, userMessage);
    }
  }

  /**
   * Parse intent from parseMessageWithGPT response
   */
  private parseIntent(intentResponse: string): AgentKitIntent {
    try {
      const parsed = JSON.parse(intentResponse);
      
      return {
        primary: this.determinePrimaryIntent(parsed.action),
        readiness: this.determineReadiness(parsed),
        confidence: 0.8, // Default confidence for parsed intent
        blockers: [],
        action: parsed.action,
        updates: parsed.updates
      };
    } catch (error) {
      console.warn('[AgentKitPlanner] Failed to parse intent, using default');
      return {
        primary: 'job_search',
        readiness: 'ready',
        confidence: 0.5,
        blockers: ['intent_parse_failed'],
        action: 'none'
      };
    }
  }

  /**
   * Generate execution steps based on intent
   */
  private async generateSteps(intent: AgentKitIntent, userContext?: any): Promise<AgentStep[]> {
    const steps: AgentStep[] = [];

    console.log('[AgentKitPlanner] Generating steps for intent:', intent.primary, intent.action);

    switch (intent.action) {
      case 'update_profile_and_refetch':
        // Profile update + job recommendation
        if (intent.updates && Object.keys(intent.updates).length > 0) {
          steps.push(this.createStep('recommend_jobs', {
            user_profile: intent.updates,
            use_chat_context: true
          }, 1));
        }
        break;

      case 'career_advice':
        // Career advice - recommend jobs based on current context
        steps.push(this.createStep('recommend_jobs', {
          user_profile: userContext?.userProfile || {},
          use_chat_context: true
        }, 1));
        break;

      default:
        // Default: provide job recommendations
        if (intent.primary === 'job_search') {
          steps.push(this.createStep('recommend_jobs', {
            user_profile: userContext?.userProfile || {},
            use_chat_context: true
          }, 1));
        } else {
          // Fallback to basic search if no specific intent
          steps.push(this.createStep('search_jobs', {
            job_title: 'Software Engineer', // Default, should be overridden by context
            city: userContext?.userProfile?.city || undefined
          }, 1));
        }
    }

    return steps;
  }

  /**
   * Create a single execution step
   */
  private createStep(toolName: string, args: Record<string, any>, priority: number): AgentStep {
    return {
      stepId: this.generateId(),
      toolName,
      args,
      priority,
      status: 'pending'
    };
  }

  /**
   * Determine primary intent category
   */
  private determinePrimaryIntent(action?: string): AgentKitIntent['primary'] {
    switch (action) {
      case 'update_profile_and_refetch':
        return 'profile_update';
      case 'career_advice':
        return 'career_advice';
      default:
        return 'job_search';
    }
  }

  /**
   * Determine user readiness state
   */
  private determineReadiness(parsed: any): AgentKitIntent['readiness'] {
    if (parsed.updates && Object.keys(parsed.updates).length > 0) {
      return 'ready'; // User has provided information
    }
    return 'profile_incomplete';
  }

  /**
   * Create fallback plan when intent parsing fails
   */
  private createFallbackPlan(sessionId: string, userMessage: string): AgentKitPlan {
    return {
      planId: this.generateId(),
      sessionId,
      steps: [
        this.createStep('recommend_jobs', {
          user_profile: {},
          use_chat_context: true
        }, 1)
      ],
      intent: {
        primary: 'job_search',
        readiness: 'ready',
        confidence: 0.3,
        blockers: ['fallback_mode'],
        action: 'none'
      },
      createdAt: new Date(),
      status: 'draft'
    };
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return crypto.randomUUID();
  }
}
