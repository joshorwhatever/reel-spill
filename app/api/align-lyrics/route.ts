import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const prompt = formData.get('prompt') as string

    if (!file) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 })
    }

    // Bypass the 'openai' npm package to avoid CSP/eval sandbox errors.
    // Native fetch works perfectly with OpenAI's multipart/form-data endpoints.
    const openAiFormData = new FormData()
    openAiFormData.append('file', file)
    openAiFormData.append('model', 'whisper-1')
    openAiFormData.append('response_format', 'verbose_json')
    
    // Pass array items individually as required by OpenAI's form-data parsing
    openAiFormData.append('timestamp_granularities[]', 'word')
    openAiFormData.append('timestamp_granularities[]', 'segment')
    
    if (prompt) {
      openAiFormData.append('prompt', prompt)
    }

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: openAiFormData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('OpenAI Raw Error:', errorText)
      throw new Error(`OpenAI API failed: ${response.statusText}`)
    }

    const transcription = await response.json()

    return NextResponse.json({
      segments: transcription.segments || [],
      words: transcription.words || [],
    })
  } catch (error: any) {
    console.error('Whisper alignment API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to align lyrics' },
      { status: 500 }
    )
  }
}