# For Minds That Wander, and Hearts That Care

## Why I Am Building NeuroProxy

I am neurodivergent, and I spend much of my time alone. I do not always feel lonely. Solitude can be comfortable, even necessary. But caring about people and knowing how to stay connected to them are not always the same thing.

In face-to-face conversations, my attention wanders. Someone is telling me something that matters, and part of my mind has already drifted somewhere else. Later, I might remember the feeling of the conversation but lose the details: what they needed, what I promised, or what I wanted to say. When messages arrive, I sometimes miss parts of them. Even when I read every word, I can spend too long trying to understand what the other person means and how I should respond. The longer I wait, the harder it becomes to begin.

As someone with ADHD, I struggle with working memory. I can care deeply about a conversation and still lose the thread before I have had the chance to act on it. I want NeuroProxy to help hold those threads for me, so that a forgotten detail does not become a forgotten person. I have long admired the thoughtful memory architecture in [Oh My Pi](https://github.com/can1357/oh-my-pi/blob/main/docs/memory.md). Its way of retaining, recalling, and making sense of context has inspired how I want to develop NeuroProxy's own memory layer. I plan to adapt those ideas to the more personal work of remembering people, conversations, and the things that matter between us.

None of this means I do not care. Sometimes it means I care so much that I am afraid of getting it wrong. Sometimes my attention simply takes a different path from the one a conversation expects. Either way, the people around me cannot always see what is happening inside my head. What they see is a missed detail, an unanswered message, or a silence that lasts longer than I intended.

I am building NeuroProxy because I want there to be a bridge between those two things: the care I feel and the care other people can actually see.

**For minds that wander, and hearts that care.**

## What I Hope It Can Become

I do not want NeuroProxy to be another chatbot that answers a question and forgets it. I want it to remember the threads I struggle to hold: the people involved, what was said, what remains uncertain, and the small actions that keep a relationship moving.

I imagine being able to speak naturally when typing and reading feel like too much. NeuroProxy could help me see the larger picture, find the heart of a difficult conversation, and take a first step when I am tempted to avoid it. It could help me understand that what someone said and what I think they meant are not necessarily the same thing. It could suggest words that are straightforward and respectful, without pretending to know another person's mind.

Over time, I want the help to become less like a collection of reminders and more like a companion that understands how I communicate. Not a replacement for my voice or my relationships, but a way to reach them more consistently. I want to learn, with its help, how to communicate more clearly and maintain lasting, close relationships.

I also do not expect one experience to represent every neurodivergent person. NeuroProxy begins with my own experience, but it should make room for different needs, preferences, boundaries, and ways of communicating.

## A Companion That Learns With Me

My long-term idea is a personal agent that becomes more useful as I use it. If I choose to give it access to my calendar, email, and other parts of my life, it could understand not only what was said in one conversation, but the context around it: what I have already committed to, how I prefer to communicate, and what I tend to miss.

I want that learning to happen gradually and visibly. If I repeatedly shorten a draft or change its tone, NeuroProxy could notice a possible preference and ask whether it should remember it. I should be able to inspect, correct, or delete that preference. A suggestion about my style should never quietly become an unquestionable fact about who I am.

The first step does not need model training. I can start with user-approved preferences and a persistent memory that retrieves only the information relevant to the current person and conversation. Facts, interpretations, outdated information, and corrections should remain distinguishable. A memory should have enough context to explain where it came from and when it may no longer be reliable.

Later, if I have enough examples that I have explicitly allowed NeuroProxy to use, I could experiment with adapting a small language model to my communication style. For example, it could learn from drafts and the versions I chose to edit and send. A small adapter, such as LoRA, may be a practical way to explore this without retraining an entire model. I would still need to compare it against an unadapted model using separate test examples. Personalization should earn its place by making the experience better, not just by making the architecture more elaborate.

A trained model should not be the only place where important facts live. My schedule changes; people and relationships change; I may want to correct or forget something. Explicit memory is easier to review and update than information absorbed into model weights. Deleting training data also does not automatically erase what a trained model may have learned, so model and adapter deletion or retraining must be part of the design.

## Trust Is Part of the Architecture

The closer an agent gets to my life, the more carefully it must handle that access. I want NeuroProxy to work toward keeping sensitive personal memory, retrieval, and model adaptation inside an environment the user controls. A sandbox can help isolate processes, but the word alone is not a privacy guarantee. I need to account for network access, mounted files, credentials, model downloads, logs, backups, and exported artifacts. A local-only training environment needs its own restricted data path and must be tested as such.

There is also an important difference between that goal and the prototype I have today. NeuroProxy currently sends relevant context to the configured AI provider for analysis, and Photon receives messages that it delivers. Voice and browser speech features may involve their own providers. I cannot honestly call the current system fully local or claim that no information leaves the device.

Access to email or a calendar should be explicit, limited, and revocable. I would start with read-only access to the smallest useful scope, show users what information is being used, and require separate authorization for actions such as sending email or changing an event. Messages and emails also contain other people's information. Giving NeuroProxy access to my account should not automatically mean that every conversation is kept forever or used for training.

I want users to be able to see and manage their own data: what has been remembered, why it was saved, what is shared with a provider, and how to delete or export it. That responsibility includes backups, cached information, and any personalized model adapters, not just the visible conversation history.

## Acting Without Taking Away My Agency

I want NeuroProxy to help when initiating a response feels difficult. That includes an AutoReply mode, but only within a scope I understand and deliberately enable. For now, the design is tied to a selected contact within a saved conversation. I should be able to turn it off, and uncertain situations should return to me for review.

Every message sent automatically should tell the recipient that it is an automatic reply from NeuroProxy. I want the person on the other side to understand who—or what—is participating. Transparency should be part of the conversation itself, not buried in a settings page.

The agent should be direct and perceptive, but it must not invent my feelings, make commitments I have not authorized, or treat its interpretation of someone else's emotions as fact. If a response needs a decision only I can make, or if someone has expressed a clear boundary, the agent should pause rather than guess. The aim is to help me participate more fully, not to keep a conversation going at any cost.

## Building a Foundation That Can Last

Today, NeuroProxy uses a local SQLite database to store its graph and conversation state. SQLite is already persistent, and it can be a useful foundation for a single-user prototype. Before replacing it, I need to make storage trustworthy: protect the data, establish encrypted backups and a recovery process, test migrations, and make deletion and export understandable. If the project eventually needs many users, multiple devices, or heavy concurrent writes, I can evaluate a different database architecture for those actual requirements.

I also want to choose agent frameworks based on what the companion needs: clear tools, limited permissions, observable decisions, durable state, and a way to hand control back to the user. A framework cannot substitute for those design choices. I would rather build and evaluate one dependable workflow than add complexity merely to make the system look more autonomous.

For now, the path is deliberately practical: make communication work, verify that people can understand and control what NeuroProxy does, and learn from real use. Then build memory, privacy, and personalization one careful step at a time.

What I want to preserve through all of it is simple: when my attention wanders, the people I care about should not have to mistake that wandering for indifference.
