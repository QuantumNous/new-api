title = Willkommen zu react und react-i18next mit fluent

description_1 = Um loszulegen, ändere <1>src/App(DE).js</1> speicheren und neuladen.
description_2 = Ändere die Sprachen zwischen deutsch und englisch mit Hilfe der beiden Schalter.

emails =
    { $unreadEmails ->
        [one] Du hast <1>eine</1> ungelesene Email.
       *[other] Du hast <1>{ $unreadEmails }</1> ungelesene Emails.
    }