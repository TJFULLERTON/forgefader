/////////////////////////////////////////////////////////
// Viewing.Extension.DualViewer
// by Philippe Leefsma, April 2016
//
/////////////////////////////////////////////////////////
import './Viewing.Extension.ExtensionManager.scss'
import ExtensionBase from 'Viewer.ExtensionBase'
import ExtensionPane from './ExtensionPane'
import ServiceManager from 'SvcManager'
import {PaneManager} from 'PaneWidget'
import ReactDOM from 'react-dom'
import React from 'react'

class ExtensionManager extends ExtensionBase {

  /////////////////////////////////////////////////////////
  // Class constructor
  //
  /////////////////////////////////////////////////////////
  constructor(viewer, options) {

    super (viewer, options)

    this.storageSvc = ServiceManager.getService(
      'StorageSvc')

    this.renderTitle = this.renderTitle.bind(this)

    this.render = this.render.bind(this)

    this.reactOpts = {
      setRenderExtension: (extension) => {

        return new Promise((resolve) => {

          const state = this.react.getState()

          this.react.setState({
            renderExtensions: [
              ...state.renderExtensions, extension
            ]

          }).then(async() => {

            resolve()

            await this.react.forceUpdate()

            this.onStopResize()
          })
        })
      }
    }

    this.react = options.react
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  get className() {

    return 'extension-manager'
  }

  /////////////////////////////////////////////////////////
  // Extension Id
  //
  /////////////////////////////////////////////////////////
  static get ExtensionId() {

    return 'Viewing.Extension.ExtensionManager'
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  sleep (ms) {

    return new Promise((resolve) => {
      setTimeout(() =>  {
        resolve()
      }, ms)
    })
  }

  /////////////////////////////////////////////////////////
  // Load callback
  //
  /////////////////////////////////////////////////////////
  load () {

    this.viewer.addEventListener(
      Autodesk.Viewing.MODEL_ROOT_LOADED_EVENT, (e) => {

        this.options.loader.hide()
      })

    this.loadEvents ()

    this.react.setState({

      extensions: this.options.extensions || [],
      visible: this.options.visible,
      renderExtensions: []

    }).then (async() => {

      await this.react.setRenderExtension(this)

      const extensions = this.options.extensions || []

      const storage = this.storageSvc.load(
        'extension-manager')

      const loadExts = extensions.filter ((extension) => {

        extension.enabled = extension.enabled ||
          storage.extensions.includes(extension.id)

        return extension.enabled
      })

      const loadTasks = loadExts.map ((extension) => {

        return this.loadDynamicExtension(extension)
      })

      this.loadedExtensions = await Promise.all(loadTasks)
    })

    console.log('Viewing.Extension.ExtensionManager loaded')

    return true
  }

  /////////////////////////////////////////////////////////
  // Unload callback
  //
  /////////////////////////////////////////////////////////
  unload () {

    console.log('Viewing.Extension.ExtensionManager unloaded')

    return true
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  loadEvents () {

    this.events = {}

    const events = [
      {
        id: Autodesk.Viewing.OBJECT_TREE_CREATED_EVENT,
        handler: 'onObjectTreeCreated'
      },
      {
        id: Autodesk.Viewing.MODEL_ROOT_LOADED_EVENT,
        handler: 'onModelRootLoaded'
      },
      {
        id: Autodesk.Viewing.GEOMETRY_LOADED_EVENT,
        handler: 'onGeometryLoaded'
      },
      {
        id: Autodesk.Viewing.TOOLBAR_CREATED_EVENT,
        handler: 'onToolbarCreated'
      }
    ]

    events.forEach((event) => {

      this.viewer.addEventListener(event.id, (e) => {

        this.events[event.id] = {
          handler: event.handler,
          args: e
        }
      })
    })
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  loadDynamicExtension (extension) {

    return new Promise((resolve, reject) => {

      const { extensions } = this.react.getState()

      extension.loading = true

      this.react.setState({
        extensions
      })

      const options = Object.assign({},
        extension.options, {
          react: this.reactOpts
        })

      this.viewer.loadDynamicExtension(
        extension.id, options).then((extInstance) => {

          extension.loading = false
          extension.enabled = true

          this.react.setState({
            extensions
          })

          resolve(extInstance)

        }, (error) => {

          reject(error)
        })
    })
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  onExtensionItemClicked (extension) {

    if (extension.loading) {

      return
    }

    if (extension.enabled) {

      this.viewer.unloadExtension(extension.id)

      const { extensions, renderExtensions } =
        this.react.getState()

      extension.enabled = false

      const renderExts =
        renderExtensions.filter((ext) => {
          return ext.id !== extension.id
        })

      this.react.setState({
        renderExtensions: renderExts,
        extensions

      }).then(() => {

        this.react.forceUpdate()

        this.storageSvc.save(
          'extension-manager', {
            extensions: extensions.filter((ext) => {
              return ext.enabled
            }).map((ext) => {
              return ext.id
            })
          })
      })

    } else {

      const { extensions } = this.react.getState()

      this.loadDynamicExtension (extension).then(
        (extInstance) => {

          this.storageSvc.save(
            'extension-manager', {
              extensions: extensions.filter((ext) => {
                return ext.enabled
              }).map((ext) => {
                return ext.id
              })
            })

          for (const eventId in this.events) {

            const event = this.events[eventId]

            if (extInstance[event.handler]) {

              extInstance[event.handler](event.args)
            }
          }
        })
    }
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  onStopResize () {

    const { renderExtensions } = this.react.getState()

    renderExtensions.forEach((extension) => {

      if (extension.onStopResize) {

        extension.onStopResize()
      }
    })
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  onResize () {

    const { renderExtensions } = this.react.getState()

    renderExtensions.forEach((extension) => {

      if (extension.onResize) {

        extension.onResize()
      }
    })
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  renderTitle () {

    return (
      <div className="title">
        <label>
          Extension Manager
        </label>
      </div>
    )
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  renderExtensions () {

    const { extensions } = this.react.getState()

    return extensions.map((extension) => {

      const className = 'item' +
        (extension.enabled ? ' enabled' : '') +
        (extension.loading ? ' loading' : '')

      return (
        <div key={extension.id} className={className}
           onClick={() => {
            this.onExtensionItemClicked(extension)
          }}>
          <label>
            { extension.name}
          </label>
        </div>
      )
    })
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  renderExtensionManager () {

    return (
      <ExtensionPane renderTitle={this.renderTitle}
        key={ExtensionManager.ExtensionId}
        className="extension-manager">

        <div className="extension-list">
          { this.renderExtensions() }
        </div>

      </ExtensionPane>
    )
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  render () {

    const state = this.react.getState()

    const renderExtensions = _.sortBy(
      state.renderExtensions, (ext) => {
        return ext.options.displayIndex || 0
      })

    const extensionPanes = renderExtensions.map (
      (extension) => {

        return (
          <ExtensionPane renderTitle={extension.renderTitle}
            onStopResize={(e) => this.onStopResize()}
            onResize={(e) => this.onResize()}
            className={extension.className}
            flex={extension.options.flex}
            key={extension.id}>

            { extension.render({showTitle: false}) }

          </ExtensionPane>
        )
      })

    const panes = state.visible
      ? [this.renderExtensionManager(), ...extensionPanes]
      :  extensionPanes

    return (
      <PaneManager orientation="horizontal">
        { panes }
      </PaneManager>
    )
  }
}

Autodesk.Viewing.theExtensionManager.registerExtension(
  ExtensionManager.ExtensionId,
  ExtensionManager)
