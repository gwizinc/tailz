export interface StoryTestResult {
  storyId: string
  status: 'pass' | 'fail' | 'skipped' | 'error'
  error?: string
}
