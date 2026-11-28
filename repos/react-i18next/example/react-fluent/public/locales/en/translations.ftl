title = Welcome to react using react-i18next with fluent

description_1 = To get started, edit <1>src/App.js</1> and save to reload.
description_2 = Switch language between english and german using buttons above.

emails =
    { $unreadEmails ->
        [one] You have <1>one</1> unread email.
       *[other] You have <1>{ $unreadEmails }</1> unread emails.
    }