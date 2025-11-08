import { Daytona } from '@daytonaio/sdk'

// Initialize the Daytona client
const daytona = new Daytona({
  apiKey:
    'dtn_88c98895a14231aea221c9689ba449a5208b8222064ff8dd5e740d135544b35b',
})

// Create the Sandbox instance
const sandbox = await daytona.create()

await sandbox.process.executeCommand('echo "hello world" > hello.txt')

const response = await sandbox.process.executeCommand('tree -L 3')
console.log(response.result)

const response2 = await sandbox.process.executeCommand('ls')
console.log(response2.result)

const response3 = await sandbox.process.executeCommand('pwd')
console.log(response3.result)

const rgResponse = await sandbox.process.executeCommand(
  'cd /home/daytona && rg hello -n',
)
console.log(JSON.stringify(rgResponse, null, 2))

//! wtf. this is not returning any string...
await sandbox.delete()
