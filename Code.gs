function buildAddOn(e) {
  if (!e || !e.gmail || !e.gmail.messageId) {
    return createErrorCard('Unable to access email message.');
  }

  try {
    const messageId = e.gmail.messageId;
    const message = GmailApp.getMessageById(messageId);
    
    if (!message) {
      return createErrorCard('Could not load email message.');
    }

    const card = CardService.newCardBuilder();
    
    // Header
    card.setHeader(CardService.newCardHeader()
      .setTitle('Webhooks')
      .setImageUrl('https://www.gstatic.com/images/icons/material/system/1x/post_gm_blue_24dp.png'));
    
    // Section 1: Webhook List with styled background
    const webhookListSection = CardService.newCardSection()
      .setHeader('📋 Webhook List')
      .setCollapsible(true)
      .addWidget(CardService.newDecoratedText()
        .setText('Your configured webhooks')
        .setWrapText(true)
        .setBottomLabel('Click trigger to execute webhook'));
    
    // Get saved webhooks
    const userProperties = PropertiesService.getUserProperties();
    const webhooks = JSON.parse(userProperties.getProperty('webhooks') || '[]');
    
    if (webhooks.length > 0) {
      webhooks.forEach(webhook => {
        // Create single trigger button instead of ButtonSet
        const triggerButton = CardService.newTextButton()
          .setText('Trigger')
          .setBackgroundColor('#1a73e8')
          .setOnClickAction(CardService.newAction()
            .setFunctionName('triggerWebhook')
            .setParameters({
              messageId: messageId,
              webhookUrl: webhook.url
            }));
        
        webhookListSection.addWidget(CardService.newKeyValue()
          .setContent(webhook.label)
          .setBottomLabel(webhook.url)
          .setButton(triggerButton));
      });
    } else {
      webhookListSection.addWidget(CardService.newTextParagraph()
        .setText('No webhooks configured yet.'));
    }
    
    // Section 2: Webhook Details
    const detailsSection = CardService.newCardSection()
      .setHeader('📝 Webhook Details')
      .setCollapsible(true);
    
    detailsSection.addWidget(CardService.newKeyValue()
      .setTopLabel('FROM')
      .setContent('Gmail Webhook')
      .setMultiline(false));
    
    detailsSection.addWidget(CardService.newKeyValue()
      .setTopLabel('SUBJECT')
      .setContent(message.getSubject())
      .setMultiline(false));
    
    const formattedDate = Utilities.formatDate(message.getDate(), 'GMT', 'MMM dd, yyyy HH:mm:ss');
    detailsSection.addWidget(CardService.newKeyValue()
      .setTopLabel('RECEIVED DATE')
      .setContent(formattedDate)
      .setMultiline(false));
    
    detailsSection.addWidget(CardService.newKeyValue()
      .setTopLabel('THREAD ID')
      .setContent(message.getThread().getId())
      .setMultiline(false));
    
    // Section 3: Command Center
    const commandSection = CardService.newCardSection()
      .setHeader('⚡ Command Center')
      .setCollapsible(false);
    
    const buttonSet = CardService.newButtonSet();
    
    buttonSet.addButton(CardService.newTextButton()
      .setText('Manage')
      .setBackgroundColor('#e8eaed')
      .setOnClickAction(CardService.newAction().setFunctionName('onManageClick')));
    
    buttonSet.addButton(CardService.newTextButton()
      .setText('Add')
      .setBackgroundColor('#1a73e8')
      .setOnClickAction(CardService.newAction().setFunctionName('onAddClick')));
    
    commandSection.addWidget(buttonSet);
    
    // Section 4: Webhook Logs
    const logsSection = CardService.newCardSection()
      .setHeader('📊 Webhook Logs')
      .setCollapsible(true);
    
    // Add refresh and clear buttons in a ButtonSet
    const logButtonSet = CardService.newButtonSet();
    logButtonSet.addButton(CardService.newTextButton()
      .setText('🔄 Refresh Logs')
      .setBackgroundColor('#e8eaed')
      .setOnClickAction(CardService.newAction()
        .setFunctionName('refreshLogs')));
    
    logButtonSet.addButton(CardService.newTextButton()
      .setText('🗑️ Clear Logs')
      .setBackgroundColor('#F4511E')
      .setOnClickAction(CardService.newAction()
        .setFunctionName('clearLogs')));
    
    logsSection.addWidget(logButtonSet);
    
    // Get logs from storage
    const logs = JSON.parse(userProperties.getProperty('webhookLogs') || '[]');
    
    if (logs.length > 0) {
      // Operations logs subsection
      logsSection.addWidget(CardService.newTextParagraph()
        .setText('🔧 Operations Logs'));
      
      const operationLogs = logs.filter(log => log.type === 'operation')
        .slice(-5).reverse();
      
      if (operationLogs.length > 0) {
        operationLogs.forEach(log => {
          logsSection.addWidget(CardService.newKeyValue()
            .setTopLabel(new Date(log.timestamp).toLocaleString())
            .setContent(log.message)
            .setBottomLabel(log.status)
            .setMultiline(true));
        });
      } else {
        logsSection.addWidget(CardService.newTextParagraph()
          .setText('No operation logs available'));
      }
      
      // Add divider between sections
      logsSection.addWidget(CardService.newDivider());
      
      // Trigger logs subsection with improved formatting
      logsSection.addWidget(CardService.newTextParagraph()
        .setText('🔔 Trigger Logs'));
      
      const triggerLogs = logs.filter(log => log.type === 'trigger')
        .slice(-5).reverse();
      
      if (triggerLogs.length > 0) {
        triggerLogs.forEach((log, index) => {
          // Extract sender email from the message
          const emailMatch = log.message.match(/for (.+?)$/);
          const sender = emailMatch ? emailMatch[1] : 'Unknown';
          
          // Format date and time
          const timestamp = new Date(log.timestamp);
          const dateTimeStr = timestamp.toLocaleString();
          
          // Get email subject from the message metadata if messageId exists
          let subject = 'No subject';
          if (log.messageId) {
            try {
              const message = GmailApp.getMessageById(log.messageId);
              if (message) {
                subject = message.getSubject() || 'No subject';
                // Truncate long subjects (if longer than 50 characters)
                if (subject.length > 50) {
                  subject = subject.substring(0, 47) + '...';
                }
              }
            } catch (error) {
              console.error('Error fetching message:', error);
              subject = 'Unable to fetch subject';
            }
          }
          
          // Create status text with proper spacing
          const statusText = log.status === 'SUCCESS' ? '  [SUCCESS]' : '  [FAILED]';
          
          // Create formatted log entry
          const logEntry = CardService.newDecoratedText()
            .setText(`#${index + 1} | ${dateTimeStr}${statusText}`)
            .setTopLabel(sender)
            .setBottomLabel(subject)
            .setWrapText(true);
          
          logsSection.addWidget(logEntry);
          
          // Add small spacing between entries
          logsSection.addWidget(CardService.newTextParagraph().setText(' '));
        });
      } else {
        logsSection.addWidget(CardService.newTextParagraph()
          .setText('No trigger logs available'));
      }
    } else {
      logsSection.addWidget(CardService.newTextParagraph()
        .setText('No logs available'));
    }
    
    // Add all sections to card
    card.addSection(webhookListSection)
       .addSection(detailsSection)
       .addSection(commandSection)
       .addSection(logsSection);
    
    return card.build();
  } catch (error) {
    return createErrorCard('Error: ' + error.toString());
  }
}

// Update the logging function to support different log types
function addWebhookLog(message, status, type = 'operation', messageId = null) {
  const userProperties = PropertiesService.getUserProperties();
  const logs = JSON.parse(userProperties.getProperty('webhookLogs') || '[]');
  
  logs.push({
    timestamp: new Date().toISOString(),
    message: message,
    status: status,
    type: type,
    messageId: messageId
  });
  
  // Keep only last 20 logs for each type
  const operationLogs = logs.filter(log => log.type === 'operation').slice(-20);
  const triggerLogs = logs.filter(log => log.type === 'trigger').slice(-20);
  
  userProperties.setProperty('webhookLogs', JSON.stringify([...operationLogs, ...triggerLogs]));
}

// Update Manage function for webhook removal and renaming
function onManageClick(e) {
  Logger.log("Manage button clicked");
  
  const card = CardService.newCardBuilder();
  
  card.setHeader(CardService.newCardHeader()
    .setTitle('Manage Webhooks')
    .setImageUrl('https://www.gstatic.com/images/icons/material/system/1x/post_gm_blue_24dp.png'));
  
  const section = CardService.newCardSection()
    .setHeader('Select webhooks to manage');
  
  const userProperties = PropertiesService.getUserProperties();
  const webhooks = JSON.parse(userProperties.getProperty('webhooks') || '[]');
  
  if (webhooks.length > 0) {
    webhooks.forEach((webhook, index) => {
      // Create text input for the label
      section.addWidget(CardService.newTextInput()
        .setFieldName(`label_${index}`)
        .setValue(webhook.label));
      
      // Show the URL (not editable)
      section.addWidget(CardService.newTextParagraph()
        .setText(webhook.url));
      
      const buttonSet = CardService.newButtonSet();
      
      // Add save button
      buttonSet.addButton(CardService.newTextButton()
        .setText('Save')
        .setBackgroundColor('#1a73e8')
        .setOnClickAction(CardService.newAction()
          .setFunctionName('saveInlineRename')
          .setParameters({ index: index.toString() })));
      
      // Add remove button
      buttonSet.addButton(CardService.newTextButton()
        .setText('Remove')
        .setBackgroundColor('#ea4335')
        .setOnClickAction(CardService.newAction()
          .setFunctionName('removeWebhook')
          .setParameters({ index: index.toString() })));
      
      section.addWidget(buttonSet);
      
      // Add a divider between webhooks
      section.addWidget(CardService.newDivider());
    });
  } else {
    section.addWidget(CardService.newTextParagraph()
      .setText('No webhooks to manage'));
  }
  
  // Add back button
  section.addWidget(CardService.newTextButton()
    .setText('Back to Main')
    .setBackgroundColor('#1a73e8')
    .setOnClickAction(CardService.newAction()
      .setFunctionName('buildAddOn')));
  
  card.addSection(section);
  return card.build();
}

// New function to handle inline rename
function saveInlineRename(e) {
  const index = parseInt(e.parameters.index);
  const newLabel = e.formInput[`label_${index}`];
  const userProperties = PropertiesService.getUserProperties();
  const webhooks = JSON.parse(userProperties.getProperty('webhooks') || '[]');
  
  if (index >= 0 && index < webhooks.length && newLabel) {
    webhooks[index].label = newLabel;
    userProperties.setProperty('webhooks', JSON.stringify(webhooks));
    
    // Add log entry
    addWebhookLog(`Renamed webhook to: ${newLabel}`, 'RENAMED');
    
    // Return to the same manage page
    return onManageClick(e);
  }
  
  return createErrorCard('Could not save renamed webhook');
}

// Update the removeWebhook function to show confirmation
function removeWebhook(e) {
  Logger.log("Remove webhook triggered with parameters: " + JSON.stringify(e.parameters));
  
  const index = parseInt(e.parameters.index);
  const userProperties = PropertiesService.getUserProperties();
  const webhooks = JSON.parse(userProperties.getProperty('webhooks') || '[]');
  
  if (index >= 0 && index < webhooks.length) {
    const removed = webhooks.splice(index, 1)[0];
    userProperties.setProperty('webhooks', JSON.stringify(webhooks));
    
    // Add log entry
    addWebhookLog(`Removed webhook: ${removed.label}`, 'REMOVED');
    
    // Return to manage page with success message
    const card = CardService.newCardBuilder();
    const section = CardService.newCardSection()
      .addWidget(CardService.newTextParagraph()
        .setText(`✅ Webhook "${removed.label}" removed successfully`));
    
    // Add back button
    section.addWidget(CardService.newTextButton()
      .setText('Back to Manage')
      .setBackgroundColor('#1a73e8')
      .setOnClickAction(CardService.newAction()
        .setFunctionName('onManageClick')));
    
    card.addSection(section);
    return card.build();
  }
  
  return createErrorCard('Could not remove webhook');
}

// Handler for Add button
function onAddClick(e) {
  return buildAddWebhookCard();
}

// Update triggerWebhook function to include logging
function triggerWebhook(e) {
  const messageId = e.parameters.messageId;
  const webhookUrl = e.parameters.webhookUrl;
  const message = GmailApp.getMessageById(messageId);
  
  if (!webhookUrl) {
    addWebhookLog('Webhook trigger failed: No webhook URL provided', 'ERROR', 'trigger', messageId);
    return createErrorCard('No webhook URL provided.');
  }
  
  try {
    // Simplified payload structure
    const emailData = {
      subject: message.getSubject(),
      from: message.getFrom(),
      to: message.getTo(),
      date: message.getDate().toISOString(),
      plainBody: message.getPlainBody().substring(0, 50000),
      htmlBody: message.getBody().substring(0, 50000),
      messageId: messageId,
      threadId: message.getThread().getId(),
      attachments: message.getAttachments().map(attachment => ({
        name: attachment.getName(),
        type: attachment.getContentType(),
        size: attachment.getSize()
      })).slice(0, 10)
    };
    
    console.log('Sending payload:', JSON.stringify(emailData));
    
    // Simplified request
    const response = UrlFetchApp.fetch(webhookUrl, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(emailData),
      muteHttpExceptions: true
    });
    
    const responseCode = response.getResponseCode();
    if (responseCode === 200) {
      addWebhookLog(
        `Webhook triggered successfully for ${message.getFrom()}`, 
        'SUCCESS', 
        'trigger',
        messageId
      );
      return createSuccessCard('Webhook triggered successfully!');
    } else {
      const errorMessage = `Webhook failed for ${message.getFrom()}`;
      addWebhookLog(errorMessage, 'ERROR', 'trigger', messageId);
      return createErrorCard(errorMessage);
    }
  } catch (error) {
    const errorMessage = `Webhook error: ${error.toString()}`;
    addWebhookLog(errorMessage, 'ERROR', 'trigger', messageId);
    return createErrorCard(errorMessage);
  }
}

// Helper function to create success card
function createSuccessCard(message) {
  const card = CardService.newCardBuilder();
  const section = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText('✅ ' + message));
  return card.addSection(section).build();
}

// Helper function to create error card
function createErrorCard(message) {
  const card = CardService.newCardBuilder();
  const section = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText('❌ ' + message));
  return card.addSection(section).build();
}

// Add this new function to your Code.gs file
function getDeploymentInfo() {
  const url = ScriptApp.getService().getUrl();
  console.log('Deployment URL:', url);
  
  // Get the current project
  const project = {
    projectId: ScriptApp.getScriptId(),
    deploymentId: null
  };
  
  // Log the information
  console.log('Project ID:', project.projectId);
  return project;
}

function buildAddWebhookCard() {
  const card = CardService.newCardBuilder();
  
  // Header
  card.setHeader(CardService.newCardHeader()
    .setTitle('Add webhook')
    .setImageUrl('https://www.gstatic.com/images/icons/material/system/1x/post_gm_blue_24dp.png'));
  
  // Main section
  const section = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph()
      .setText('Use this form to add new webhook to your library.'));
  
  // Create new webhook subsection
  section.addWidget(CardService.newTextParagraph()
      .setText('Create new webhook'));
  
  // URL Input
  section.addWidget(CardService.newTextInput()
    .setFieldName('webhookUrl')
    .setTitle('URL')
    .setHint('Enter webhook URL.'));
  
  // Label Input
  section.addWidget(CardService.newTextInput()
    .setFieldName('webhookLabel')
    .setTitle('Label')
    .setHint('Enter label for the webhook.'));
  
  // Add webhook button
  section.addWidget(CardService.newTextButton()
    .setText('Add webhook')
    .setBackgroundColor('#1a73e8')
    .setOnClickAction(CardService.newAction()
      .setFunctionName('saveWebhook')));
  
  // POST reminder
  section.addWidget(CardService.newTextParagraph()
    .setText('⚡ To trigger your webhook properly, remember to set it to POST.'));
  
  card.addSection(section);
  
  return card.build();
}

// Function to save the webhook
function saveWebhook(e) {
  const webhookUrl = e.formInput.webhookUrl;
  const webhookLabel = e.formInput.webhookLabel;
  
  if (!webhookUrl || !webhookLabel) {
    return createErrorCard('Please fill in both URL and Label fields.');
  }
  
  try {
    // Get existing webhooks or initialize empty array
    const userProperties = PropertiesService.getUserProperties();
    const webhooks = JSON.parse(userProperties.getProperty('webhooks') || '[]');
    
    // Add new webhook
    webhooks.push({
      url: webhookUrl,
      label: webhookLabel
    });
    
    // Save updated webhooks
    userProperties.setProperty('webhooks', JSON.stringify(webhooks));
    
    // Test the webhook with simplified payload
    const testResponse = UrlFetchApp.fetch(webhookUrl, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        test: true,
        timestamp: new Date().toISOString()
      }),
      muteHttpExceptions: true
    });
    
    if (testResponse.getResponseCode() === 200) {
      return createSuccessCard('Webhook added successfully!');
    } else {
      return createErrorCard('Webhook added but test failed. Please verify the URL.');
    }
    
  } catch (error) {
    return createErrorCard('Error saving webhook: ' + error.toString());
  }
}

function testWebhookAccess(url) {
  try {
    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ test: true }),
      muteHttpExceptions: true
    });
    
    console.log('Test response code:', response.getResponseCode());
    console.log('Test response:', response.getContentText());
    return response.getResponseCode();
  } catch (error) {
    console.error('Test error:', error);
    return error.toString();
  }
}

// Add this new function to handle log refresh
function refreshLogs(e) {
  return buildAddOn(e);
}

// Function to clear all logs
function clearLogs(e) {
  try {
    const userProperties = PropertiesService.getUserProperties();
    userProperties.setProperty('webhookLogs', '[]');
    
    // Return to main view
    return buildAddOn(e);
  } catch (error) {
    return createErrorCard('Error clearing logs: ' + error.toString());
  }
}