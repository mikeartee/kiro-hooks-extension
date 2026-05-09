# Triage Labels

This repository uses the default canonical label vocabulary. All six labels must exist in GitHub Issues before the `triage` skill can apply them.

## Label Mapping

| Canonical role     | Label string        | Meaning                                                        |
|--------------------|---------------------|----------------------------------------------------------------|
| needs-triage       | `needs-triage`      | Maintainer needs to evaluate this issue                        |
| needs-info         | `needs-info`        | Waiting on reporter for more information                       |
| ready-for-agent    | `ready-for-agent`   | Fully specified — an AFK agent can pick this up autonomously   |
| ready-for-human    | `ready-for-human`   | Needs human implementation or judgment                         |
| tracking           | `tracking`          | Container/parent issue — work lives in sub-issues              |
| wontfix            | `wontfix`           | Will not be actioned                                           |

## Creating Labels in GitHub

Run once to bootstrap the label set:

```bash
gh label create "needs-triage"    --repo mikeartee/kiro-hooks-extension --color "e4e669" --description "Maintainer needs to evaluate"
gh label create "needs-info"      --repo mikeartee/kiro-hooks-extension --color "d876e3" --description "Waiting on reporter"
gh label create "ready-for-agent" --repo mikeartee/kiro-hooks-extension --color "0075ca" --description "AFK-ready — fully specified"
gh label create "ready-for-human" --repo mikeartee/kiro-hooks-extension --color "e99695" --description "Needs human implementation"
gh label create "tracking"        --repo mikeartee/kiro-hooks-extension --color "bfd4f2" --description "Parent/container issue"
gh label create "wontfix"         --repo mikeartee/kiro-hooks-extension --color "ffffff" --description "Will not be actioned"
```
