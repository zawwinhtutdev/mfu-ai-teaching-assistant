import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

export default function TermsPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-6">
      <div className="w-full max-w-4xl">
        <div className="mb-6">
          <a href="/login" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700">
            <ArrowLeft className="h-4 w-4" />
            Back to Login
          </a>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Terms and Conditions</CardTitle>
            <CardDescription>MFU AI Teaching Assistant - Terms of Service</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-3">1. Acceptance of Terms</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                By using the MFU AI Teaching Assistant, you agree to be bound by these terms and conditions. 
                If you do not agree to these terms, please do not use our service.
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-3">2. Use of Service</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                This service is designed for educational purposes at Mae Fah Luang University. 
                Users must use the service responsibly and in accordance with university policies.
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-3">3. Privacy and Data</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                We respect your privacy and handle your data according to our privacy policy. 
                Conversations may be stored for service improvement purposes.
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-3">4. AI Assistant</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                The AI assistant is designed to help with educational content. 
                While we strive for accuracy, users should verify important information independently.
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-3">5. Prohibited Uses</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Users may not use the service for illegal activities, harassment, or any purpose 
                that violates university policies or applicable laws.
              </p>
            </div>
            
            <div className="pt-4 border-t">
              <p className="text-xs text-gray-500">
                Last updated: {new Date().toLocaleDateString()}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
